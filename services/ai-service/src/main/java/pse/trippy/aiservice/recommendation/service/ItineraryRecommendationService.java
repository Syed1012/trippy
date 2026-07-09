package pse.trippy.aiservice.recommendation.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pse.trippy.aiservice.recommendation.dto.RecommendationRequest;
import pse.trippy.aiservice.recommendation.dto.RecommendationResponse;
import pse.trippy.aiservice.recommendation.dto.RecommendationResponse.DayRecommendations;
import pse.trippy.aiservice.recommendation.dto.RecommendationResponse.RecommendationOption;
import pse.trippy.aiservice.recommendation.model.ItineraryRecommendation;
import pse.trippy.aiservice.recommendation.repository.ItineraryRecommendationRepository;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.IntStream;

/**
 * Builds local-Ollama itinerary suggestions from trip context (destination,
 * preferences and any existing day plans), persists them, and returns three
 * distinct options per requested day for the trip AI sidebar.
 *
 * <p>Fully isolated from the Groq-backed {@code AiService}: on any failure (or
 * when disabled) it degrades to a deterministic fallback so the UI never breaks.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ItineraryRecommendationService {

    private static final String[] VIBES = {"Top Pick", "Adventurer", "Hidden Gem"};
    private static final String DEFAULT_CURRENCY = "USD";
    private static final Duration OLLAMA_TIMEOUT = Duration.ofSeconds(90);

    private final OllamaRecommendationClient ollama;
    private final ItineraryRecommendationRepository repository;
    private final ObjectMapper mapper;

    @Transactional
    public RecommendationResponse generate(RecommendationRequest request) {
        boolean singleDay = request.dayNumber() != null;
        List<Integer> dayNumbers = singleDay
                ? List.of(Math.max(1, request.dayNumber()))
                : IntStream.rangeClosed(1, Math.max(1, request.days())).boxed().toList();

        String source = "AI";
        String model = ollama.model();
        Map<Integer, List<RecommendationOption>> byDay;

        try {
            if (!ollama.isEnabled()) {
                throw new IllegalStateException("AI recommendations disabled via AI_RECO_ENABLED");
            }
            String content = ollama.chatJson(buildSystemPrompt(), buildUserPrompt(request, dayNumbers), OLLAMA_TIMEOUT);
            byDay = parseOptions(content, dayNumbers, request);
        } catch (Exception ex) {
            log.warn("Ollama itinerary recommendation failed ({}), using fallback", ex.getMessage());
            source = "FALLBACK";
            model = "fallback";
            byDay = fallbackOptions(dayNumbers, request);
        }

        persist(request, dayNumbers, byDay, model, source, singleDay);

        List<DayRecommendations> days = new ArrayList<>();
        for (int day : dayNumbers) {
            days.add(new DayRecommendations(day, byDay.getOrDefault(day, List.of())));
        }
        return new RecommendationResponse(request.tripId(), model, source, Instant.now(), days);
    }

    // ------------------------------------------------------------------ prompts

    private String buildSystemPrompt() {
        return """
                You are Trippy's expert travel-itinerary planner.
                For every requested day, propose exactly 3 distinct full-day plan options that a traveller could realistically follow.
                Each option must be concrete and specific to the destination (name real neighbourhoods, landmarks or experiences).
                Respond with STRICT JSON only, no prose, matching exactly this shape:
                {
                  "days": [
                    {
                      "dayNumber": 1,
                      "options": [
                        {
                          "title": "short punchy plan name (max 8 words)",
                          "startTime": "HH:MM",
                          "endTime": "HH:MM",
                          "estimatedCost": 120,
                          "currency": "USD",
                          "notes": "1-2 sentence description of the plan and why it fits",
                          "mapsQuery": "a specific place to search on Google Maps"
                        }
                      ]
                    }
                  ]
                }
                Rules: every day has exactly 3 options; estimatedCost is a number (per person, whole units); times use 24h HH:MM; keep notes concise; never include markdown or comments.
                """;
    }

    private String buildUserPrompt(RecommendationRequest request, List<Integer> dayNumbers) {
        StringBuilder sb = new StringBuilder();
        sb.append("Destination: ").append(request.destination().trim()).append('\n');
        sb.append("Total trip length: ").append(Math.max(1, request.days())).append(" day(s)\n");

        RecommendationRequest.PreferenceContext prefs = request.preferences();
        if (prefs != null) {
            List<String> parts = new ArrayList<>();
            if (isSet(prefs.tripType())) parts.add("trip type = " + prefs.tripType());
            if (isSet(prefs.budgetTier())) parts.add("budget = " + prefs.budgetTier());
            if (isSet(prefs.preferredWeather())) parts.add("preferred weather = " + prefs.preferredWeather());
            if (!parts.isEmpty()) {
                sb.append("Traveller preferences: ").append(String.join(", ", parts)).append('\n');
            }
            if (isSet(prefs.notes())) {
                sb.append("Traveller notes: ").append(prefs.notes().trim()).append('\n');
            }
        }

        List<RecommendationRequest.DayContext> existing = request.existingItinerary();
        if (existing != null && !existing.isEmpty()) {
            sb.append("\nAlready-planned days (do NOT duplicate these; complement them):\n");
            for (RecommendationRequest.DayContext day : existing) {
                if (day == null || day.activities() == null || day.activities().isEmpty()) {
                    continue;
                }
                sb.append("- Day ").append(day.dayNumber() == null ? "?" : day.dayNumber());
                if (isSet(day.title())) sb.append(" (").append(day.title().trim()).append(')');
                sb.append(": ");
                List<String> acts = new ArrayList<>();
                for (RecommendationRequest.ActivityContext act : day.activities()) {
                    if (act == null || !isSet(act.title())) continue;
                    acts.add((isSet(act.time()) ? act.time().trim() + " " : "") + act.title().trim());
                }
                sb.append(String.join("; ", acts)).append('\n');
            }
        }

        String dayList = dayNumbers.stream().map(String::valueOf).reduce((a, b) -> a + ", " + b).orElse("1");
        sb.append("\nGenerate 3 options for each of these day number(s): ").append(dayList).append('.');
        sb.append("\nReturn JSON with a \"days\" array containing an entry for every one of those day numbers.");
        return sb.toString();
    }

    // ------------------------------------------------------------------ parsing

    private Map<Integer, List<RecommendationOption>> parseOptions(
            String content, List<Integer> dayNumbers, RecommendationRequest request) throws Exception {
        JsonNode root = mapper.readTree(content);

        Map<Integer, JsonNode> dayNodes = new LinkedHashMap<>();
        JsonNode daysNode = root.path("days");
        if (daysNode.isArray()) {
            for (JsonNode dayNode : daysNode) {
                int dn = dayNode.path("dayNumber").asInt(-1);
                if (dn > 0) {
                    dayNodes.put(dn, dayNode.path("options"));
                }
            }
        }
        // Single-day responses may omit the wrapper and return { "options": [...] }.
        if (dayNodes.isEmpty() && root.path("options").isArray() && dayNumbers.size() == 1) {
            dayNodes.put(dayNumbers.get(0), root.path("options"));
        }

        Map<Integer, List<RecommendationOption>> byDay = new LinkedHashMap<>();
        for (int day : dayNumbers) {
            JsonNode optionsNode = dayNodes.get(day);
            List<RecommendationOption> options = new ArrayList<>();
            if (optionsNode != null && optionsNode.isArray()) {
                int index = 0;
                for (JsonNode optionNode : optionsNode) {
                    if (index >= VIBES.length) break;
                    options.add(toOption(optionNode, index, request));
                    index++;
                }
            }
            // Guarantee exactly three options; pad from the fallback set if the model was short.
            if (options.size() < VIBES.length) {
                List<RecommendationOption> pad = fallbackForDay(day, request);
                for (int i = options.size(); i < VIBES.length; i++) {
                    options.add(pad.get(i));
                }
            }
            byDay.put(day, options);
        }
        return byDay;
    }

    private RecommendationOption toOption(JsonNode node, int index, RecommendationRequest request) {
        String title = textOrDefault(node.path("title"), "Day plan " + (index + 1));
        String start = textOrDefault(node.path("startTime"), "09:00");
        String end = textOrDefault(node.path("endTime"), "18:00");
        String currency = textOrDefault(node.path("currency"), DEFAULT_CURRENCY);
        String notes = textOrDefault(node.path("notes"), "");
        String mapsQuery = textOrDefault(node.path("mapsQuery"), title);

        BigDecimal cost;
        JsonNode costNode = node.path("estimatedCost");
        if (costNode.isNumber()) {
            cost = BigDecimal.valueOf(costNode.asDouble()).setScale(2, RoundingMode.HALF_UP);
        } else if (costNode.isTextual() && !costNode.asText().isBlank()) {
            cost = parseCost(costNode.asText());
        } else {
            cost = defaultCost(request);
        }

        return new RecommendationOption(
                UUID.randomUUID(),
                VIBES[index],
                title,
                start,
                end,
                cost,
                currency,
                mapsUrl(mapsQuery, request.destination()),
                notes
        );
    }

    // ----------------------------------------------------------------- fallback

    private Map<Integer, List<RecommendationOption>> fallbackOptions(
            List<Integer> dayNumbers, RecommendationRequest request) {
        Map<Integer, List<RecommendationOption>> byDay = new LinkedHashMap<>();
        for (int day : dayNumbers) {
            byDay.put(day, fallbackForDay(day, request));
        }
        return byDay;
    }

    private List<RecommendationOption> fallbackForDay(int day, RecommendationRequest request) {
        String destination = request.destination().trim();
        BigDecimal base = defaultCost(request);
        String[] titles = {
                "Highlights of " + destination,
                "Off-the-map " + destination,
                "Local flavours of " + destination
        };
        String[] notes = {
                "Cover the must-see landmarks at an easy pace with time to wander.",
                "Trade the crowds for lesser-known corners and a bit of adventure.",
                "Follow the food and neighbourhood spots the locals love."
        };
        String[] starts = {"09:00", "08:30", "10:00"};
        String[] ends = {"17:00", "18:30", "19:00"};
        BigDecimal[] costs = {
                base,
                base.multiply(BigDecimal.valueOf(1.25)).setScale(2, RoundingMode.HALF_UP),
                base.multiply(BigDecimal.valueOf(0.85)).setScale(2, RoundingMode.HALF_UP)
        };

        List<RecommendationOption> options = new ArrayList<>();
        for (int i = 0; i < VIBES.length; i++) {
            options.add(new RecommendationOption(
                    UUID.randomUUID(),
                    VIBES[i],
                    titles[i],
                    starts[i],
                    ends[i],
                    costs[i],
                    DEFAULT_CURRENCY,
                    mapsUrl(titles[i], destination),
                    notes[i]
            ));
        }
        return options;
    }

    // ---------------------------------------------------------------- persistence

    private void persist(RecommendationRequest request, List<Integer> dayNumbers,
                         Map<Integer, List<RecommendationOption>> byDay,
                         String model, String source, boolean singleDay) {
        if (request.tripId() == null) {
            return;
        }
        if (singleDay) {
            repository.deleteByTripIdAndDayNumber(request.tripId(), dayNumbers.get(0));
        } else {
            repository.deleteByTripId(request.tripId());
        }

        List<ItineraryRecommendation> rows = new ArrayList<>();
        for (int day : dayNumbers) {
            List<RecommendationOption> options = byDay.getOrDefault(day, List.of());
            for (int index = 0; index < options.size(); index++) {
                RecommendationOption option = options.get(index);
                rows.add(ItineraryRecommendation.builder()
                        .tripId(request.tripId())
                        .dayNumber(day)
                        .optionIndex(index)
                        .vibe(option.vibe())
                        .title(option.title())
                        .startTime(option.startTime())
                        .endTime(option.endTime())
                        .estimatedCost(option.cost())
                        .currency(option.currency())
                        .mapsUrl(option.mapsUrl())
                        .notes(clamp(option.notes(), 2000))
                        .model(clamp(model, 80))
                        .source(source)
                        .build());
            }
        }
        repository.saveAll(rows);
    }

    // --------------------------------------------------------------------- utils

    private BigDecimal defaultCost(RecommendationRequest request) {
        String tier = request.preferences() == null ? null : request.preferences().budgetTier();
        if (tier != null) {
            switch (tier.trim().toUpperCase()) {
                case "ECONOMY" -> {
                    return BigDecimal.valueOf(45).setScale(2, RoundingMode.HALF_UP);
                }
                case "LUXURY" -> {
                    return BigDecimal.valueOf(220).setScale(2, RoundingMode.HALF_UP);
                }
                default -> {
                    return BigDecimal.valueOf(95).setScale(2, RoundingMode.HALF_UP);
                }
            }
        }
        return BigDecimal.valueOf(95).setScale(2, RoundingMode.HALF_UP);
    }

    private BigDecimal parseCost(String raw) {
        String digits = raw.replaceAll("[^0-9.]", "");
        if (digits.isBlank()) {
            return BigDecimal.valueOf(95).setScale(2, RoundingMode.HALF_UP);
        }
        try {
            return new BigDecimal(digits).setScale(2, RoundingMode.HALF_UP);
        } catch (NumberFormatException ex) {
            return BigDecimal.valueOf(95).setScale(2, RoundingMode.HALF_UP);
        }
    }

    private String mapsUrl(String query, String destination) {
        String combined = (query == null ? "" : query.trim());
        if (destination != null && !combined.toLowerCase().contains(destination.trim().toLowerCase())) {
            combined = (combined.isEmpty() ? "" : combined + " ") + destination.trim();
        }
        String encoded = URLEncoder.encode(combined, StandardCharsets.UTF_8);
        return "https://www.google.com/maps/search/?api=1&query=" + encoded;
    }

    private String textOrDefault(JsonNode node, String fallback) {
        if (node == null || node.isMissingNode() || node.isNull()) {
            return fallback;
        }
        String value = node.asText("").trim();
        return value.isEmpty() ? fallback : value;
    }

    private String clamp(String value, int max) {
        if (value == null) {
            return null;
        }
        return value.length() <= max ? value : value.substring(0, max);
    }

    private boolean isSet(String value) {
        return value != null && !value.isBlank();
    }
}
