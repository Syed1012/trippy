package pse.trippy.aiservice.recommendation.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import pse.trippy.aiservice.recommendation.dto.RecommendationRequest;
import pse.trippy.aiservice.recommendation.dto.RecommendationResponse;
import pse.trippy.aiservice.recommendation.dto.RecommendationResponse.DayRecommendations;
import pse.trippy.aiservice.recommendation.dto.RecommendationResponse.RecommendationOption;
import pse.trippy.aiservice.recommendation.model.ItineraryRecommendation;

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
import java.util.regex.Matcher;
import java.util.regex.Pattern;
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
    private final RecommendationPersistence persistence;
    private final ObjectMapper mapper;

    public RecommendationResponse generate(RecommendationRequest request) {
        boolean singleDay = request.dayNumber() != null;
        List<Integer> dayNumbers = singleDay
                ? List.of(Math.max(1, request.dayNumber()))
                : IntStream.rangeClosed(1, Math.max(1, request.days())).boxed().toList();
        long startedAt = System.currentTimeMillis();

        if (singleDay) {
            log.info("AI itinerary regeneration started for trip={} day={} destination='{}' preferences=[{}] model={}",
                    request.tripId(), dayNumbers.get(0), request.destination(),
                    summarizePreferences(request.preferences()), ollama.model());
        } else {
            log.info("AI itinerary generation started for trip={} destination='{}' days={} preferences=[{}] model={}",
                    request.tripId(), request.destination(), dayNumbers.size(),
                    summarizePreferences(request.preferences()), ollama.model());
        }

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
            log.warn("AI itinerary generation fell back to templates for trip={} ({})",
                    request.tripId(), ex.getMessage());
            source = "FALLBACK";
            model = "fallback";
            byDay = fallbackOptions(dayNumbers, request);
        }

        // Persistence is best-effort: the recommendations are already built, so a
        // storage hiccup (e.g. a concurrent regeneration) must not fail the request.
        try {
            persist(request, dayNumbers, byDay, model, source, singleDay);
        } catch (Exception ex) {
            log.warn("Failed to store itinerary recommendations for trip={}: {}",
                    request.tripId(), ex.getMessage());
        }

        List<DayRecommendations> days = new ArrayList<>();
        for (int day : dayNumbers) {
            days.add(new DayRecommendations(day, byDay.getOrDefault(day, List.of())));
        }
        log.info("AI itinerary {} completed for trip={} source={} model={} days={} durationMs={}",
                singleDay ? "regeneration" : "generation", request.tripId(), source, model,
                dayNumbers.size(), System.currentTimeMillis() - startedAt);
        return new RecommendationResponse(request.tripId(), model, source, Instant.now(), days);
    }

    /** Returns the previously generated recommendations for a trip (empty if none stored). */
    public RecommendationResponse getStored(UUID tripId) {
        List<ItineraryRecommendation> rows = persistence.findForTrip(tripId);
        if (rows.isEmpty()) {
            log.info("No stored AI itinerary found for trip={}", tripId);
            return new RecommendationResponse(tripId, null, null, null, List.of());
        }

        Map<Integer, List<RecommendationOption>> byDay = new LinkedHashMap<>();
        String model = null;
        String source = null;
        for (ItineraryRecommendation row : rows) {
            model = row.getModel();
            source = row.getSource();
            byDay.computeIfAbsent(row.getDayNumber(), key -> new ArrayList<>())
                    .add(new RecommendationOption(
                            row.getId(), row.getVibe(), row.getTitle(), row.getStartTime(),
                            row.getEndTime(), row.getEstimatedCost(), row.getCurrency(),
                            row.getMapsUrl(), row.getNotes(),
                            // location isn't persisted; the title is a specific place name.
                            row.getTitle()));
        }

        List<DayRecommendations> days = byDay.entrySet().stream()
                .map(entry -> new DayRecommendations(entry.getKey(), entry.getValue()))
                .toList();
        log.info("Returning stored AI itinerary for trip={} days={}", tripId, days.size());
        return new RecommendationResponse(tripId, model, source, Instant.now(), days);
    }

    private String summarizePreferences(RecommendationRequest.PreferenceContext prefs) {
        if (prefs == null) {
            return "none";
        }
        List<String> parts = new ArrayList<>();
        if (isSet(prefs.tripType())) parts.add("type=" + prefs.tripType());
        if (isSet(prefs.budgetTier())) parts.add("budget=" + prefs.budgetTier());
        if (isSet(prefs.preferredWeather())) parts.add("weather=" + prefs.preferredWeather());
        if (isSet(prefs.notes())) parts.add("notes");
        return parts.isEmpty() ? "none" : String.join(", ", parts);
    }

    // ------------------------------------------------------------------ prompts

    private String buildSystemPrompt() {
        return """
                You are Trippy's expert local travel planner.
                For every requested day, propose exactly 3 distinct, SPECIFIC options a traveller can actually do.
                Each option must centre on ONE real, named place at the destination — a specific cafe, restaurant,
                museum, trail, mountain, beach, market, viewpoint or landmark. Use its real name; never a generic
                theme like "Highlights of X" or "Local flavours of X".
                Respond with STRICT JSON only, no prose, matching exactly this shape:
                {
                  "days": [
                    {
                      "dayNumber": 1,
                      "options": [
                        {
                          "title": "the real place or experience name (max 8 words, e.g. 'Griffith Observatory sunset')",
                          "location": "the specific place and area, searchable on a map (e.g. 'Griffith Observatory, Los Angeles')",
                          "startTime": "HH:MM",
                          "endTime": "HH:MM",
                          "estimatedCost": 25,
                          "currency": "USD",
                          "notes": "1-2 sentences: what to do there and why it fits",
                          "mapsQuery": "the exact place to search on Google Maps"
                        }
                      ]
                    }
                  ]
                }
                Rules: every day has exactly 3 options; title and location must both name a real, specific place (never
                generic); estimatedCost is a number (per person, whole units); times use 24h HH:MM; keep notes concise;
                never include markdown or comments.
                """;
    }

    private String buildUserPrompt(RecommendationRequest request, List<Integer> dayNumbers) {
        StringBuilder sb = new StringBuilder();
        sb.append("Destination: ").append(request.destination().trim()).append('\n');
        sb.append("Total trip length: ").append(Math.max(1, request.days())).append(" day(s)\n");

        if (isSet(request.dayWish())) {
            sb.append("The traveller's explicit wish for the requested day(s): \"")
                    .append(request.dayWish().trim())
                    .append("\" — every option MUST honour this wish.\n");
        }

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
                List<RecommendationOption> pad = fallbackForDay(request);
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
        String start = parseClockTime(node.path("startTime"), "09:00");
        String end = parseClockTime(node.path("endTime"), "18:00");
        String currency = textOrDefault(node.path("currency"), DEFAULT_CURRENCY);
        String notes = textOrDefault(node.path("notes"), "");
        String location = textOrDefault(node.path("location"), request.destination().trim());
        String mapsQuery = textOrDefault(node.path("mapsQuery"), location);

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
                notes,
                location
        );
    }

    // ----------------------------------------------------------------- fallback

    private Map<Integer, List<RecommendationOption>> fallbackOptions(
            List<Integer> dayNumbers, RecommendationRequest request) {
        Map<Integer, List<RecommendationOption>> byDay = new LinkedHashMap<>();
        for (int day : dayNumbers) {
            byDay.put(day, fallbackForDay(request));
        }
        return byDay;
    }

    private List<RecommendationOption> fallbackForDay(RecommendationRequest request) {
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
                    notes[i],
                    destination
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

        if (singleDay) {
            persistence.replaceForDay(request.tripId(), dayNumbers.get(0), rows);
        } else {
            persistence.replaceForTrip(request.tripId(), rows);
        }
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
        String combined = query == null ? "" : query.trim();
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

    // A small local model rarely sticks to the requested "HH:MM" shape verbatim —
    // it drifts to "9:00 AM", "09.00", "0930", or prose like "Start around 9am".
    // Extract a clock time wherever it appears rather than rejecting the option
    // outright, so the frontend's strict HH:mm save-time parser always gets a
    // value it can store instead of silently dropping the activity's time.
    private static final Pattern TIME_WITH_SEPARATOR =
            Pattern.compile("(\\d{1,2})\\s*[:.hH]\\s*(\\d{2})\\s*([AaPp][Mm])?");
    private static final Pattern TIME_HOUR_ONLY =
            Pattern.compile("\\b(\\d{1,2})\\s*([AaPp][Mm])\\b");
    private static final Pattern TIME_COMPACT =
            Pattern.compile("\\b([01]\\d|2[0-3])([0-5]\\d)\\b");

    private String parseClockTime(JsonNode node, String fallback) {
        String raw = textOrDefault(node, "");
        if (raw.isEmpty()) {
            return fallback;
        }

        Matcher m = TIME_WITH_SEPARATOR.matcher(raw);
        if (m.find()) {
            int minute = Integer.parseInt(m.group(2));
            if (minute <= 59) {
                int hour = to24Hour(Integer.parseInt(m.group(1)), m.group(3));
                if (hour >= 0) {
                    return String.format("%02d:%02d", hour, minute);
                }
            }
        }

        m = TIME_HOUR_ONLY.matcher(raw);
        if (m.find()) {
            int hour = to24Hour(Integer.parseInt(m.group(1)), m.group(2));
            if (hour >= 0) {
                return String.format("%02d:00", hour);
            }
        }

        m = TIME_COMPACT.matcher(raw);
        if (m.find()) {
            return m.group(1) + ":" + m.group(2);
        }

        log.debug("Could not parse AI-provided time '{}', using fallback {}", raw, fallback);
        return fallback;
    }

    /** Resolves a possibly 12-hour hour + optional am/pm marker to 24-hour; -1 if out of range. */
    private int to24Hour(int hour, String meridiem) {
        if (meridiem != null) {
            if (hour < 1 || hour > 12) {
                return -1;
            }
            boolean pm = meridiem.equalsIgnoreCase("pm");
            hour = hour % 12;
            if (pm) {
                hour += 12;
            }
            return hour;
        }
        return hour <= 23 ? hour : -1;
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
