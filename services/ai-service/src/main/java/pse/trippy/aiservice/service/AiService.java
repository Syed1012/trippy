package pse.trippy.aiservice.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.stereotype.Service;
import io.micrometer.core.instrument.MeterRegistry;
import pse.trippy.aiservice.dto.request.AiChatRequest;
import pse.trippy.aiservice.dto.request.DestinationSuggestionRequest;
import pse.trippy.aiservice.dto.request.GenerateItineraryRequest;
import pse.trippy.aiservice.dto.request.GroupPreferenceRequest;
import pse.trippy.aiservice.dto.request.TravelAdviceRequest;
import pse.trippy.aiservice.dto.request.TripConstraints;
import pse.trippy.aiservice.dto.response.AiChatResponse;
import pse.trippy.aiservice.dto.response.ConsolidatedPreferencesResponse;
import pse.trippy.aiservice.dto.response.DestinationSuggestion;
import pse.trippy.aiservice.dto.response.DestinationSuggestionResponse;
import pse.trippy.aiservice.dto.response.ItineraryResponse;
import pse.trippy.aiservice.dto.response.TravelAdviceResponse;
import pse.trippy.aiservice.logging.LogSanitizer;
import pse.trippy.aiservice.model.entity.GenerationHistory;
import pse.trippy.aiservice.repository.GenerationHistoryRepository;
import pse.trippy.aiservice.service.fallback.FallbackDestinationCatalogue;
import pse.trippy.aiservice.service.fallback.FallbackItineraryGenerator;

import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.net.http.HttpTimeoutException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.List;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.time.temporal.ChronoUnit;
import java.util.stream.Collectors;
import java.util.HashSet;
import java.util.Set;

@Slf4j
@Service
@RequiredArgsConstructor
public class AiService {

    private static final Duration ITINERARY_TIMEOUT = Duration.ofSeconds(30);
    private static final Duration WEATHER_REQUEST_TIMEOUT = Duration.ofSeconds(5);
    private static final Duration TRANSPORT_REQUEST_TIMEOUT = Duration.ofSeconds(5);
    private static final int ITINERARY_MAX_ATTEMPTS = 3;
    private static final String AI_PROVIDER_UNAVAILABLE = "AI_PROVIDER_UNAVAILABLE";
    private static final String AI_TIMEOUT = "AI_TIMEOUT";
    private static final String AI_RATE_LIMITED = "AI_RATE_LIMITED";
    private static final String AI_EMPTY_RESPONSE = "AI_EMPTY_RESPONSE";
    private static final String AI_MALFORMED_RESPONSE = "AI_MALFORMED_RESPONSE";
    private static final String AI_SCHEMA_INVALID = "AI_SCHEMA_INVALID";
    private static final String AI_UNUSABLE_RESPONSE = "AI_UNUSABLE_RESPONSE";
    private static final int MIN_ACTIVITIES_PER_DAY = 5;

    private final ChatClient chatClient;
    private final ObjectMapper objectMapper;
    private final GenerationHistoryRepository generationHistoryRepository;
    private final ExecutorService aiBlockingExecutor;
    private final FallbackDestinationCatalogue fallbackDestinationCatalogue;
    private final FallbackItineraryGenerator fallbackItineraryGenerator;
    private final MeterRegistry meterRegistry;

    @Value("${spring.ai.openai.api-key}")
    private String apiKey;

    @Value("${spring.ai.openai.base-url:https://api.groq.com/openai}")
    private String baseUrl;

    @Value("${spring.ai.openai.chat.options.model:llama-3.3-70b-versatile}")
    private String model;

    @Value("${trippy.ai.groq.api-key:${GROQ_API_KEY:}}")
    private String groqApiKey;

    @Value("${trippy.ai.groq.base-url:https://api.groq.com/openai}")
    private String groqBaseUrl;

    @Value("${trippy.ai.groq.model:llama-3.3-70b-versatile}")
    private String groqModel;

    @Value("${trippy.ai.groq.api-key1:${GROQ_API_KEY1:}}")
    private String groqApiKey1;

    @Value("${trippy.ai.opencode.api-key:${Opencode_API_KEY:}}")
    private String opencodeApiKey;

    @Value("${trippy.ai.opencode.base-url:https://opencode.ai/zen/go/v1}")
    private String opencodeBaseUrl;

    @Value("${trippy.ai.opencode.model:openai/gpt-4o}")
    private String opencodeModel;

    private final java.util.concurrent.atomic.AtomicInteger activeProviderIndex = new java.util.concurrent.atomic.AtomicInteger(0);
    private final java.util.concurrent.atomic.AtomicLong lastFailureTime = new java.util.concurrent.atomic.AtomicLong(0);

    @Value("${trippy.weather.openweather-api-key:}")
    private String openWeatherApiKey;

    @Value("${trippy.weather.geocoding-url:https://api.openweathermap.org/geo/1.0/direct}")
    private String openWeatherGeocodingUrl;

    @Value("${trippy.weather.forecast-url:https://api.openweathermap.org/data/2.5/forecast}")
    private String openWeatherForecastUrl;

    @Value("${trippy.transport.osrm-base-url:https://router.project-osrm.org}")
    private String osrmBaseUrl;

    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(20))
            .build();

    public DestinationSuggestionResponse suggestDestinations(DestinationSuggestionRequest request) {
        String prompt = buildDestinationPrompt(request);
        log.info("Requesting destination suggestions");

        try {
            String rawJson = requestAi(prompt);
            List<DestinationSuggestion> suggestions = parseDestinationSuggestions(rawJson);
            return new DestinationSuggestionResponse(suggestions, Instant.now(), false);
        } catch (Exception ex) {
            String fallbackReason = fallbackReason(ex);
            log.warn("Destination suggestions using fallback catalogue reason={} error={}",
                    fallbackReason, LogSanitizer.safeError(ex));
            List<DestinationSuggestion> suggestions = fallbackDestinationCatalogue.suggestDestinations(request, 5);
            if (suggestions.isEmpty() && request.city() != null && !request.city().isBlank()) {
                throw new IllegalArgumentException("Fallback is not available for " + request.city()
                        + ". Please start the AI service or try a supported fallback destination.");
            }
            return new DestinationSuggestionResponse(suggestions, Instant.now(), false);
        }
    }

    public ItineraryResponse generateItinerary(GenerateItineraryRequest request) {
        validateItineraryRequest(request);
        UUID generationId = UUID.randomUUID();
        ItineraryGenerationResult result = createItinerary(request, generationId);
        saveGenerationHistory(request, result.response(), result.prompt(), historyStatus(result.response()));
        return result.response();
    }

    private ItineraryGenerationResult createItinerary(GenerateItineraryRequest request, UUID generationId) {
        Map<LocalDate, Map<Integer, HourlyForecast>> hourlyWeatherMap = fetchHourlyWeatherMap(request);
        Map<LocalDate, ItineraryResponse.WeatherSummary> weatherByDate = computeDailySummaries(hourlyWeatherMap);
        String prompt = buildItineraryPrompt(request, weatherByDate);
        log.debug("Generating itinerary for destination: {}", request.constraints().destination());

        try {
            String rawJson = requestAiWithRetry(prompt, ITINERARY_MAX_ATTEMPTS, ITINERARY_TIMEOUT);
            ItineraryResponse response = objectMapper.readValue(
                    extractJson(rawJson), ItineraryResponse.class);
            response.setGenerationId(generationId);
            response.setGeneratedAt(Instant.now());
            response.setFallbackUsed(false);
            validateAiItineraryResponse(response, request);
            enrichItineraryWithHourlyWeather(response, request, weatherByDate, hourlyWeatherMap);
            return new ItineraryGenerationResult(response, prompt);
        } catch (Exception ex) {
            String fallbackReason = fallbackReason(ex);
            log.warn("AI itinerary generation using fallback catalogue reason={} error={}",
                    fallbackReason, LogSanitizer.safeError(ex));
            ItineraryResponse fallback = fallbackItineraryGenerator.generate(request, fallbackReason);
            fallback.setGenerationId(generationId);
            fallback.setTokensUsed(0);
            fallback.setFallbackUsed(true);
            fallback.setFallbackReason(fallbackReason);
            fallback.setGeneratedAt(Instant.now());
            enrichItineraryWithHourlyWeather(fallback, request, weatherByDate, hourlyWeatherMap);
            meterRegistry.counter("ai.itinerary.fallback", "reason", fallbackReason).increment();
            return new ItineraryGenerationResult(fallback, prompt);
        }
    }

    public ItineraryResponse retryItinerary(UUID generationId) {
        GenerationHistory history = generationHistoryRepository.findByGenerationId(generationId)
                .orElseThrow(() -> new IllegalArgumentException("Generation ID not found"));

        if (history.getRetryCount() >= 3) {
            throw new IllegalStateException("Maximum retry attempts reached for this generation");
        }

        GenerateItineraryRequest request = objectMapper.convertValue(history.getRequestPayload(), GenerateItineraryRequest.class);
        validateItineraryRequest(request);
        ItineraryGenerationResult result = createItinerary(request, generationId);
        updateGenerationHistory(history, request, result.response(), result.prompt());
        return result.response();
    }

    public TravelAdviceResponse getTravelAdvice(TravelAdviceRequest request) {
        String prompt = buildAdvicePrompt(request);
        log.debug("Getting travel advice for destination: {}", request.getDestination());

        String rawJson;
        try {
            rawJson = chatClient.prompt()
                    .user(prompt)
                    .call()
                    .content();
        } catch (Exception ex) {
            log.warn("Spring AI call failed, falling back to direct Groq API error={}",
                    LogSanitizer.safeError(ex));
            rawJson = callGroqDirect(prompt);
        }

        try {
            TravelAdviceResponse response = objectMapper.readValue(
                    extractJson(rawJson), TravelAdviceResponse.class);
            response.setGeneratedAt(Instant.now());
            return response;
        } catch (JsonProcessingException e) {
            log.warn("Could not parse structured response, returning plain text answer");
            return TravelAdviceResponse.builder()
                    .answer(rawJson)
                    .relatedQuestions(List.of())
                    .generatedAt(Instant.now())
                    .build();
        }
    }

    public AiChatResponse chat(AiChatRequest request) {
        String lastMessage = request.messages().get(request.messages().size() - 1).content();

        if (request.currentItinerary() != null && !request.currentItinerary().isEmpty()) {
            String prompt = buildItineraryChatPrompt(request, lastMessage);
            try {
                String rawJson = requestAi(prompt);
                JsonNode root = objectMapper.readTree(extractJson(rawJson));
                List<ItineraryResponse.DayPlan> updatedItinerary = objectMapper.convertValue(
                        root.path("dailyPlan"),
                        new TypeReference<>() {
                        });

                if (updatedItinerary != null && !updatedItinerary.isEmpty()) {
                    return new AiChatResponse(
                            "Trip updated based on your request.",
                            updatedItinerary,
                            List.of(new AiChatResponse.Change(
                                    "info",
                                    null,
                                    null,
                                    null,
                                    "Itinerary updated based on your request.")),
                            true);
                }
            } catch (Exception ex) {
                log.warn("AI itinerary chat update failed, falling back to conversational answer error={}",
                        LogSanitizer.safeError(ex));
            }
        }

        String reply;
        try {
            reply = requestAi(buildGeneralChatPrompt(request));
        } catch (Exception ex) {
            log.warn("AI chat failed, returning local fallback error={}", LogSanitizer.safeError(ex));
            reply = "I can help with destination ideas, itinerary changes, food, transport, packing, and budget tips. Try asking for a specific change to your trip.";
        }

        return new AiChatResponse(reply, null, List.of(), false);
    }

    public ConsolidatedPreferencesResponse consolidatePreferences(GroupPreferenceRequest request) {
        List<GroupPreferenceRequest.UserPreference> preferences = request.preferences();

        String recommendedBudget = mostCommon(preferences.stream()
                .map(GroupPreferenceRequest.UserPreference::budgetPreference)
                .toList(), "MODERATE");
        String recommendedPace = mostCommon(preferences.stream()
                .map(GroupPreferenceRequest.UserPreference::pacePreference)
                .toList(), "MODERATE");

        List<String> sharedInterests = valuesMentionedByMultipleTravelers(
                preferences.stream()
                        .flatMap(p -> safeTextList(p.interests()).stream())
                        .toList());
        List<String> mustSeeConsensus = valuesMentionedByMultipleTravelers(
                preferences.stream()
                        .flatMap(p -> safeTextList(p.mustSee()).stream())
                        .toList());
        List<ConsolidatedPreferencesResponse.Conflict> conflicts = detectPreferenceConflicts(preferences);

        String prompt = buildSuggestedGroupPrompt(
                recommendedBudget,
                recommendedPace,
                sharedInterests,
                mustSeeConsensus,
                conflicts);

        return new ConsolidatedPreferencesResponse(
                recommendedBudget,
                recommendedPace,
                sharedInterests,
                mustSeeConsensus,
                conflicts,
                prompt);
    }

    private List<DestinationSuggestion> parseDestinationSuggestions(String rawJson) {
        if (rawJson == null || rawJson.isBlank()) {
            throw new FallbackTriggerException(AI_EMPTY_RESPONSE, "AI returned an empty suggestion response");
        }

        try {
            String cleanJson = extractJson(rawJson);
            log.debug("Extracted destination suggestion JSON chars={}", cleanJson.length());

            List<DestinationSuggestion> suggestions;
            if (cleanJson.strip().startsWith("[")) {
                suggestions = objectMapper.readValue(cleanJson, new TypeReference<>() {
                });
            } else {
                JsonNode root = objectMapper.readTree(cleanJson);
                JsonNode suggestionsNode = root.path("suggestions");
                if (!suggestionsNode.isArray()) {
                    throw new FallbackTriggerException(AI_SCHEMA_INVALID,
                            "AI suggestion response did not contain a suggestions array");
                }
                suggestions = objectMapper.convertValue(suggestionsNode, new TypeReference<>() {
                });
            }

            List<DestinationSuggestion> usableSuggestions = safeList(suggestions).stream()
                    .filter(this::isUsableSuggestion)
                    .toList();
            if (usableSuggestions.isEmpty()) {
                throw new FallbackTriggerException(AI_UNUSABLE_RESPONSE,
                        "AI returned no usable destination suggestions");
            }
            return usableSuggestions;
        } catch (FallbackTriggerException ex) {
            throw ex;
        } catch (JsonProcessingException | IllegalArgumentException ex) {
            throw new FallbackTriggerException(AI_MALFORMED_RESPONSE,
                    "AI returned malformed destination suggestion JSON", ex);
        }
    }

    private boolean isUsableSuggestion(DestinationSuggestion suggestion) {
        return suggestion != null
                && suggestion.destination() != null
                && !suggestion.destination().isBlank()
                && suggestion.country() != null
                && !suggestion.country().isBlank()
                && suggestion.description() != null
                && !suggestion.description().isBlank()
                && suggestion.highlights() != null
                && !suggestion.highlights().isEmpty()
                && suggestion.estimatedDailyCost() != null
                && suggestion.bestTimeToVisit() != null
                && !suggestion.bestTimeToVisit().isBlank()
                && Double.isFinite(suggestion.matchScore());
    }

    private void validateItineraryRequest(GenerateItineraryRequest request) {
        if (request == null) {
            throw new IllegalArgumentException("Generate itinerary request is required");
        }
        TripConstraints constraints = request.constraints();
        if (constraints == null) {
            throw new IllegalArgumentException("Trip constraints are required");
        }
        if (constraints.destination() == null || constraints.destination().isBlank()) {
            throw new IllegalArgumentException("Destination is required");
        }
        if (constraints.startDate() == null || constraints.endDate() == null) {
            throw new IllegalArgumentException("Start date and end date are required");
        }
        if (constraints.endDate().isBefore(constraints.startDate())) {
            throw new IllegalArgumentException("Trip end date must not be before start date");
        }
    }

    private void validateAiItineraryResponse(ItineraryResponse response, GenerateItineraryRequest request) {
        if (response == null || response.getDailyPlan() == null || response.getDailyPlan().isEmpty()) {
            throw new FallbackTriggerException(AI_UNUSABLE_RESPONSE, "AI returned an empty itinerary");
        }

        int expectedDays = Math.toIntExact(ChronoUnit.DAYS.between(
                request.constraints().startDate(),
                request.constraints().endDate()) + 1);
        if (response.getDailyPlan().size() != expectedDays) {
            throw new FallbackTriggerException(AI_SCHEMA_INVALID,
                    "AI itinerary did not contain the requested number of days");
        }

        Set<Integer> dayNumbers = new HashSet<>();
        for (ItineraryResponse.DayPlan day : response.getDailyPlan()) {
            if (day == null || day.getDayNumber() == null
                    || day.getDayNumber() < 1 || day.getDayNumber() > expectedDays) {
                throw new FallbackTriggerException(AI_SCHEMA_INVALID,
                        "AI itinerary contained an invalid day number");
            }
            if (!dayNumbers.add(day.getDayNumber())) {
                throw new FallbackTriggerException(AI_SCHEMA_INVALID,
                        "AI itinerary contained duplicate day numbers");
            }
            if (day.getActivities() == null || day.getActivities().size() < MIN_ACTIVITIES_PER_DAY) {
                throw new FallbackTriggerException(AI_UNUSABLE_RESPONSE,
                        "AI itinerary contained fewer than " + MIN_ACTIVITIES_PER_DAY + " activities for a day");
            }
        }
    }

    // -------------------------------------------------------------------------
    // Prompt builders
    // -------------------------------------------------------------------------

    private String buildDestinationPrompt(DestinationSuggestionRequest req) {
        StringBuilder sb = new StringBuilder();
        sb.append("You are Trippy AI, a travel expert. Suggest personalized travel destinations based on these preferences:\n\n");

        if (req.city() != null && !req.city().isBlank()) {
            sb.append("Requested destination/city: ").append(req.city()).append("\n");
            sb.append("Focus primarily on this destination. If useful, include nearby alternatives as secondary suggestions.\n");
        }
        if (req.prompt() != null && !req.prompt().isBlank()) sb.append("User request: ").append(req.prompt()).append("\n");
        if (req.interests() != null && !req.interests().isEmpty())
            sb.append("Interests: ").append(String.join(", ", req.interests())).append("\n");
        if (req.budget() != null) sb.append("Budget: ").append(req.budget()).append("\n");
        if (req.travelStyle() != null) sb.append("Travel Style: ").append(req.travelStyle()).append("\n");
        sb.append("Duration: ").append(req.duration()).append(" days\n");
        if (req.people() != null) sb.append("Travelers: ").append(req.people()).append("\n");
        if (req.diet() != null && !req.diet().isBlank()) sb.append("Dietary requirements: ").append(req.diet()).append("\n");
        if (req.preferences() != null && !req.preferences().isBlank()) sb.append("Preferences: ").append(req.preferences()).append("\n");
        if (req.customNotes() != null && !req.customNotes().isBlank()) sb.append("Custom notes: ").append(req.customNotes()).append("\n");
        if (req.region() != null) sb.append("Region: ").append(req.region()).append("\n");
        if (req.month() != null) sb.append("Travel month: ").append(req.month()).append("\n");

        sb.append("""
                
                Return ONLY a JSON object (no markdown, no code fences) with this shape:
                {
                  "suggestions": [
                    {
                      "destination": "full destination name (city, country)",
                      "country": "country name",
                      "description": "1-2 sentence reason tailored to the user",
                      "highlights": ["top highlight 1", "top highlight 2", "top highlight 3"],
                      "estimatedDailyCost": 100,
                      "bestTimeToVisit": "best months to visit",
                      "googleMapsUrl": "https://www.google.com/maps/dir/?api=1&destination=encoded destination",
                      "matchScore": 0.92
                    }
                  ]
                }

                Each object must contain:
                - "destination": full destination name (city, country)
                - "country": country name
                - "description": 1-2 sentence description
                - "highlights": array of 3 top highlights/attractions
                - "estimatedDailyCost": estimated daily cost in EUR as a number
                - "bestTimeToVisit": best months to visit
                - "googleMapsUrl": Google Maps directions URL for the destination using https://www.google.com/maps/dir/?api=1&destination=
                - "matchScore": how well this matches the preferences (0.0 to 1.0)

                Return 3 to 5 destination suggestions.
                """);
        return sb.toString();
    }

    private String buildItineraryPrompt(GenerateItineraryRequest req, Map<LocalDate, ItineraryResponse.WeatherSummary> weatherByDate) {
        TripConstraints c = req.constraints();
        StringBuilder sb = new StringBuilder();
        sb.append("You are a professional travel planner. Create a detailed day-by-day itinerary.\n\n");
        sb.append("Destination: ").append(c.destination()).append("\n");
        sb.append("From: ").append(c.startDate()).append(" to ").append(c.endDate()).append("\n");
        if (c.travelers() != null) {
            sb.append("Travelers: ").append(c.travelers().adults()).append(" adult(s), ")
              .append(c.travelers().children()).append(" child(ren)\n");
        }
        if (c.budgetLevel() != null) sb.append("Budget level: ").append(c.budgetLevel()).append("\n");
        if (req.tone() != null) sb.append("Tone: ").append(req.tone()).append("\n");

        if (weatherByDate != null && !weatherByDate.isEmpty()) {
            sb.append("Real-time Destination Weather Forecast:\n");
            weatherByDate.forEach((date, w) -> {
                sb.append("  - ").append(date).append(": ").append(w.getCondition())
                  .append(" (").append(w.getTemperatureCelsius()).append("°C)\n");
            });
            sb.append("WEATHER DIRECTIVE: Match activities with forecast. If rain, drizzle, thunderstorm or snow is forecasted, schedule indoor activities (museums, galleries, covered markets, indoor dining).\n");
        }

        if (req.userPrompt() != null && !req.userPrompt().isBlank())
            sb.append("Special instructions: ").append(req.userPrompt()).append("\n");

        if (req.preferences() != null) {
            GenerateItineraryRequest.ItineraryPreferences p = req.preferences();
            sb.append("Include transport: ").append(p.includeTransport()).append("\n");
            sb.append("Include meals: ").append(p.includeMeals()).append("\n");
            if (p.pacePreference() != null) sb.append("Pace: ").append(p.pacePreference()).append("\n");
            if (p.mustSeeAttractions() != null && !p.mustSeeAttractions().isEmpty())
                sb.append("Must see: ").append(String.join(", ", p.mustSeeAttractions())).append("\n");
            if (p.avoidAttractions() != null && !p.avoidAttractions().isEmpty())
                sb.append("Avoid: ").append(String.join(", ", p.avoidAttractions())).append("\n");
        }

        sb.append("""

                Itinerary quality requirements:
                - Return exactly one day object for every calendar date in the requested range.
                - Each day must contain 5 to 6 practical activities. Use 7 only when the requested pace is PACKED.
                - Cover the whole usable day: morning, late morning, lunch or food stop, afternoon, early evening, and optional dinner/night activity.
                - Use real venues, neighborhoods, viewpoints, stations, restaurants/markets, beaches, museums, or routes for the destination.
                - Do not use placeholders like "explore the city", "flexible activity", or generic hotel check-in as most of the day.
                - Sequence activities by realistic geography and travel time. A full-day tour counts as one activity, so still include meals and evening context around it.
                - Include plausible durationMinutes, category, cost, tips, bookingRequired, Google Maps URL, and coordinates whenever possible.

                Respond ONLY with a valid JSON object (no markdown, no extra text):
                {
                  "tripTitle": "string",
                  "summary": "string",
                  "totalEstimatedCost": "string",
                  "dailyPlan": [
                    {
                      "dayNumber": 1,
                      "date": "YYYY-MM-DD",
                      "title": "string",
                      "weather": {
                        "condition": "string",
                        "temperatureCelsius": 18,
                        "advice": "string"
                      },
                      "transportRecommendations": [
                        {
                          "from": "string",
                          "to": "string",
                          "mode": "walk|metro|bus|train|taxi",
                          "estimatedDuration": "string",
                          "notes": "string"
                        }
                      ],
                      "activities": [
                        {
                          "time": "HH:mm",
                          "durationMinutes": 60,
                          "title": "string",
                          "description": "string",
                          "location": "string",
                          "category": "SIGHTSEEING",
                          "estimatedCost": "string",
                          "tips": "string",
                          "bookingRequired": false,
                          "googleMapsUrl": "https://www.google.com/maps/dir/?api=1&destination=encoded venue",
                          "lat": 35.0,
                          "lng": 135.0
                        }
                      ]
                    }
                  ],
                  "packingTips": ["string"],
                  "travelTips": ["string"]
                }
                """);
        return sb.toString();
    }

    private String buildAdvicePrompt(TravelAdviceRequest req) {
        StringBuilder sb = new StringBuilder();
        sb.append("You are a knowledgeable travel advisor. Answer the following travel question.\n\n");
        sb.append("Destination: ").append(req.getDestination()).append("\n");
        sb.append("Question: ").append(req.getQuestion()).append("\n");
        if (req.getContext() != null && !req.getContext().isBlank())
            sb.append("Context: ").append(req.getContext()).append("\n");

        sb.append("""

                Respond ONLY with a valid JSON object (no markdown, no extra text):
                {
                  "answer": "string",
                  "relatedQuestions": ["string", "string", "string"]
                }
                """);
        return sb.toString();
    }

    private String buildItineraryChatPrompt(AiChatRequest request, String lastMessage) {
        return """
                You are Trippy AI, an expert travel planner.

                Trip context:
                %s

                Destination:
                %s

                The user wants to modify their existing trip itinerary.
                User request: "%s"

                Current itinerary JSON:
                %s

                Return ONLY valid JSON, no markdown and no explanation, in exactly this shape:
                {
                  "dailyPlan": [
                    {
                      "dayNumber": 1,
                      "date": "YYYY-MM-DD",
                      "title": "Day title",
                      "activities": [
                        {
                          "time": "09:00",
                          "durationMinutes": 60,
                          "title": "Activity",
                          "description": "Description",
                          "location": "Venue, Address",
                          "category": "FOOD|SIGHTSEEING|TRANSPORT|SHOPPING|CULTURE|NIGHTLIFE|NATURE|WELLNESS",
                          "estimatedCost": "€15",
                          "tips": "Useful tip",
                          "bookingRequired": false,
                          "googleMapsUrl": "https://www.google.com/maps/dir/?api=1&destination=encoded venue",
                          "lat": 48.8566,
                          "lng": 2.3522
                        }
                      ]
                    }
                  ]
                }

                Keep the same JSON structure and day numbering unless the user explicitly asks to change them.
                Use real places and realistic costs for the destination.
                """.formatted(
                request.tripContext() == null ? "" : request.tripContext(),
                request.destination() == null ? "the destination" : request.destination(),
                lastMessage,
                writeJson(request.currentItinerary()));
    }

    private String buildGeneralChatPrompt(AiChatRequest request) {
        String conversation = request.messages().stream()
                .map(message -> message.role() + ": " + message.content())
                .reduce((a, b) -> a + "\n" + b)
                .orElse("");

        return """
                You are Trippy AI, a concise travel assistant. Only answer travel planning questions.
                Use EUR (€) for rough costs when relevant.

                Trip context:
                %s

                Destination:
                %s

                Conversation:
                %s
                """.formatted(
                request.tripContext() == null ? "" : request.tripContext(),
                request.destination() == null ? "the destination" : request.destination(),
                conversation);
    }

    @SuppressWarnings("PMD.UnusedPrivateMethod")
    private void enrichItinerary(ItineraryResponse response, GenerateItineraryRequest request) {
        enrichItinerary(response, request, Map.of());
    }

    private void enrichItinerary(ItineraryResponse response, GenerateItineraryRequest request,
                                Map<LocalDate, ItineraryResponse.WeatherSummary> prefetchedWeather) {
        Map<LocalDate, Map<Integer, HourlyForecast>> hourlyMap = fetchHourlyWeatherMap(request);
        Map<LocalDate, ItineraryResponse.WeatherSummary> weatherByDate =
                (prefetchedWeather != null && !prefetchedWeather.isEmpty())
                        ? prefetchedWeather
                        : computeDailySummaries(hourlyMap);
        enrichItineraryWithHourlyWeather(response, request, weatherByDate, hourlyMap);
    }

    private void enrichItineraryWithHourlyWeather(ItineraryResponse response, GenerateItineraryRequest request,
                                                   Map<LocalDate, ItineraryResponse.WeatherSummary> weatherByDate,
                                                   Map<LocalDate, Map<Integer, HourlyForecast>> hourlyWeatherMap) {
        if (response.getDailyPlan() == null || response.getDailyPlan().isEmpty()) {
            ItineraryResponse fallback = buildFallbackItinerary(request, "AI returned an empty itinerary");
            response.setDailyPlan(fallback.getDailyPlan());
            response.setFallbackUsed(true);
            response.setFallbackReason(fallback.getFallbackReason());
        }

        if (response.getPackingTips() == null) {
            response.setPackingTips(List.of("Comfortable walking shoes", "Reusable water bottle"));
        }
        if (response.getTravelTips() == null) {
            response.setTravelTips(List.of("Confirm opening hours before visiting major attractions."));
        }

        boolean includeTransport = request.preferences() == null || request.preferences().includeTransport();
        LocalDate startDate = request.constraints().startDate();

        for (int i = 0; i < response.getDailyPlan().size(); i++) {
            ItineraryResponse.DayPlan day = response.getDailyPlan().get(i);
            int dayNumber = day.getDayNumber() != null ? day.getDayNumber() : i + 1;
            LocalDate date = parseDate(day.getDate())
                    .orElse(startDate.plusDays(Math.max(0, dayNumber - 1L)));
            if (day.getDayNumber() == null) {
                day.setDayNumber(dayNumber);
            }
            if (day.getDate() == null || day.getDate().isBlank()) {
                day.setDate(date.toString());
            }
            if (day.getWeather() == null || isUnavailableWeather(day.getWeather())) {
                day.setWeather(weatherByDate.getOrDefault(date, unavailableWeather()));
            }

            Map<Integer, HourlyForecast> dayHourly = hourlyWeatherMap != null ? hourlyWeatherMap.getOrDefault(date, Map.of()) : Map.of();
            if (day.getActivities() == null) {
                day.setActivities(List.of());
            } else {
                String adaptedTime = null;
                boolean activityAdapted = false;

                for (ItineraryResponse.Activity activity : day.getActivities()) {
                    int hour = parseHour(activity.getTime());
                    HourlyForecast hf = findClosestHourlyForecast(dayHourly, hour);
                    if (hf != null) {
                        activity.setWeatherCondition(hf.condition());
                        activity.setWeatherTemp(hf.temperatureCelsius());
                        activity.setIsRainy(hf.isRainy());
                    } else if (day.getWeather() != null && !isUnavailableWeather(day.getWeather())) {
                        activity.setWeatherCondition(day.getWeather().getCondition());
                        activity.setWeatherTemp(day.getWeather().getTemperatureCelsius());
                        activity.setIsRainy(isRainyWeather(day.getWeather()));
                    }

                    if (!Boolean.TRUE.equals(response.getFallbackUsed()) && Boolean.TRUE.equals(activity.getIsRainy()) && isOutdoorActivity(activity)) {
                        adaptOutdoorActivityToIndoor(activity);
                        activity.setTips("Weather adaptation (" + defaultString(activity.getTime(), "Day") + " " + defaultString(activity.getWeatherCondition(), "Rain") + "): Indoor venue selected due to forecasted rain.");
                        activityAdapted = true;
                        if (adaptedTime == null && activity.getTime() != null) adaptedTime = activity.getTime();
                    }
                }
                if (activityAdapted && day.getWeather() != null) {
                    day.getWeather().setAdvice("Rain forecasted around " + (adaptedTime != null ? adaptedTime : "the day") + " — outdoor activity updated to indoor alternative.");
                }
            }

            if (includeTransport && (day.getTransportRecommendations() == null
                    || day.getTransportRecommendations().isEmpty())) {
                day.setTransportRecommendations(buildTransportRecommendations(day.getActivities()));
            }
        }
    }

    private ItineraryResponse buildFallbackItinerary(GenerateItineraryRequest request, String reason) {
        TripConstraints constraints = request.constraints();
        LocalDate current = constraints.startDate();
        LocalDate end = constraints.endDate();
        List<ItineraryResponse.DayPlan> days = new ArrayList<>();
        boolean includeMeals = request.preferences() == null || request.preferences().includeMeals();
        boolean includeTransport = request.preferences() == null || request.preferences().includeTransport();

        int dayNumber = 1;
        while (!current.isAfter(end) && dayNumber <= 14) {
            List<ItineraryResponse.Activity> activities = new ArrayList<>();
            activities.add(ItineraryResponse.Activity.builder()
                    .time("09:00")
                    .durationMinutes(60)
                    .title("Arrival briefing and central orientation")
                    .description("Start in the most central area, confirm transit passes, and mark the day's key stops.")
                    .location(constraints.destination())
                    .googleMapsUrl(googleMapsDirectionsUrl(constraints.destination()))
                    .category("FREE_TIME")
                    .estimatedCost("€0")
                    .tips("Use this block to reduce friction before the sightseeing-heavy part of the day.")
                    .bookingRequired(false)
                    .build());
            activities.add(ItineraryResponse.Activity.builder()
                    .time("10:30")
                    .durationMinutes(120)
                    .title("Major landmark and neighborhood walk")
                    .description("Visit a signature landmark, then walk nearby streets to understand the local layout.")
                    .location(constraints.destination())
                    .googleMapsUrl(googleMapsDirectionsUrl(constraints.destination()))
                    .category("SIGHTSEEING")
                    .estimatedCost("€0-€25")
                    .tips("Check ticket windows and opening hours before leaving.")
                    .bookingRequired(false)
                    .build());
            if (includeMeals) {
                activities.add(ItineraryResponse.Activity.builder()
                        .time("12:30")
                        .durationMinutes(75)
                        .title("Local lunch")
                        .description("Choose a well-reviewed local restaurant near the morning stop.")
                        .location(constraints.destination())
                        .googleMapsUrl(googleMapsDirectionsUrl(constraints.destination()))
                        .category("FOOD")
                        .estimatedCost("€15-€30")
                        .tips("Reserve ahead for popular places.")
                        .bookingRequired(false)
                        .build());
            }
            activities.add(ItineraryResponse.Activity.builder()
                    .time("15:00")
                    .durationMinutes(120)
                    .title("Museum, market, or cultural stop")
                    .description("Choose a high-value indoor or cultural stop that matches the group's interests.")
                    .location(constraints.destination())
                    .googleMapsUrl(googleMapsDirectionsUrl(constraints.destination()))
                    .category("CULTURE")
                    .estimatedCost("€0-€25")
                    .tips("Keep this flexible if weather or travel delays change the day.")
                    .bookingRequired(false)
                    .build());
            activities.add(ItineraryResponse.Activity.builder()
                    .time("17:30")
                    .durationMinutes(90)
                    .title("Scenic viewpoint or relaxed local district")
                    .description("Wind down with a viewpoint, waterfront, park, or atmospheric local quarter.")
                    .location(constraints.destination())
                    .googleMapsUrl(googleMapsDirectionsUrl(constraints.destination()))
                    .category("SIGHTSEEING")
                    .estimatedCost("€0-€15")
                    .tips("Good timing for photos and a lower-pressure group check-in.")
                    .bookingRequired(false)
                    .build());
            if (activities.size() < MIN_ACTIVITIES_PER_DAY) {
                activities.add(ItineraryResponse.Activity.builder()
                        .time("19:30")
                        .durationMinutes(90)
                        .title("Evening food and next-day planning")
                        .description("Pick a convenient dinner area and review the next day's route while everyone is together.")
                        .location(constraints.destination())
                        .googleMapsUrl(googleMapsDirectionsUrl(constraints.destination()))
                        .category("FOOD")
                        .estimatedCost("€20-€40")
                        .tips("Reserve if the group is larger than four people.")
                        .bookingRequired(false)
                        .build());
            }

            ItineraryResponse.DayPlan day = ItineraryResponse.DayPlan.builder()
                    .dayNumber(dayNumber)
                    .date(current.toString())
                    .title("Day " + dayNumber + " in " + constraints.destination())
                    .weather(unavailableWeather())
                    .activities(activities)
                    .build();
            if (includeTransport) {
                day.setTransportRecommendations(buildTransportRecommendations(activities));
            }
            days.add(day);
            current = current.plusDays(1);
            dayNumber++;
        }

        return ItineraryResponse.builder()
                .tripTitle(days.size() + " Days in " + constraints.destination())
                .summary("Fallback itinerary generated from your trip constraints.")
                .totalEstimatedCost("Estimate unavailable")
                .dailyPlan(days)
                .packingTips(List.of("Comfortable walking shoes", "Weather-appropriate layers"))
                .travelTips(List.of("Use this fallback as a starting point and regenerate when AI is available."))
                .generatedAt(Instant.now())
                .tokensUsed(0)
                .fallbackUsed(true)
                .fallbackReason(defaultString(reason, "AI response unavailable"))
                .build();
    }

    public record HourlyForecast(
            String timeStr,
            int hour,
            String condition,
            Double temperatureCelsius,
            boolean isRainy,
            int precipProb
    ) {}

    private Map<LocalDate, Map<Integer, HourlyForecast>> fetchHourlyWeatherMap(GenerateItineraryRequest request) {
        if (openWeatherApiKey != null && !openWeatherApiKey.isBlank()) {
            try {
                String encodedDestination = URLEncoder.encode(
                        request.constraints().destination(), StandardCharsets.UTF_8);
                String geoUrl = appendQuery(openWeatherGeocodingUrl,
                        "q=" + encodedDestination + "&limit=1&appid=" + encodeQueryParam(openWeatherApiKey));
                JsonNode geo = sendJsonGet(geoUrl, WEATHER_REQUEST_TIMEOUT, "OpenWeather geocoding");
                if (geo.isArray() && !geo.isEmpty()) {
                    double lat = geo.get(0).path("lat").asDouble();
                    double lon = geo.get(0).path("lon").asDouble();
                    String forecastUrl = appendQuery(openWeatherForecastUrl,
                            "lat=" + lat + "&lon=" + lon + "&units=metric&appid=" + encodeQueryParam(openWeatherApiKey));
                    JsonNode list = sendJsonGet(forecastUrl, WEATHER_REQUEST_TIMEOUT, "OpenWeather forecast")
                            .path("list");
                    if (list.isArray() && !list.isEmpty()) {
                        Map<LocalDate, Map<Integer, HourlyForecast>> result = new LinkedHashMap<>();
                        for (JsonNode item : list) {
                            String dtTxt = item.path("dt_txt").asText("");
                            String[] parts = dtTxt.split(" ");
                            if (parts.length < 2) continue;
                            Optional<LocalDate> date = parseDate(parts[0]);
                            if (date.isEmpty()) continue;

                            int hour = parseHour(parts[1]);
                            double temp = item.path("main").path("temp").asDouble(20.0);
                            String condition = item.path("weather").path(0).path("main").asText("Clear");
                            int pop = (int) (item.path("pop").asDouble(0.0) * 100);
                            boolean isRainy = isRainyCondition(condition) || pop >= 60;

                            HourlyForecast h = new HourlyForecast(
                                    parts[1].substring(0, Math.min(5, parts[1].length())),
                                    hour, condition, Math.round(temp * 10.0) / 10.0, isRainy, pop
                            );
                            result.computeIfAbsent(date.get(), k -> new LinkedHashMap<>()).put(hour, h);
                        }
                        if (!result.isEmpty()) return result;
                    }
                }
            } catch (InterruptedException ex) {
                Thread.currentThread().interrupt();
                log.warn("OpenWeather hourly lookup interrupted, falling back to Open-Meteo error={}",
                        LogSanitizer.safeError(ex));
            } catch (IOException | IllegalStateException ex) {
                log.warn("OpenWeather hourly lookup failed, falling back to Open-Meteo error={}", LogSanitizer.safeError(ex));
            }
        }
        return fetchOpenMeteoHourlyWeather(request.constraints().destination());
    }

    private Map<LocalDate, Map<Integer, HourlyForecast>> fetchOpenMeteoHourlyWeather(String destination) {
        if (destination == null || destination.isBlank()) {
            return Map.of();
        }
        try {
            String encodedDestination = URLEncoder.encode(destination, StandardCharsets.UTF_8);
            String geoUrl = "https://geocoding-api.open-meteo.com/v1/search?name=" + encodedDestination + "&count=1";
            JsonNode geo = sendJsonGet(geoUrl, WEATHER_REQUEST_TIMEOUT, "Open-Meteo geocoding");
            JsonNode results = geo.path("results");
            if (!results.isArray() || results.isEmpty()) {
                return Map.of();
            }

            double lat = results.get(0).path("latitude").asDouble();
            double lon = results.get(0).path("longitude").asDouble();

            String forecastUrl = "https://api.open-meteo.com/v1/forecast?latitude=" + lat + "&longitude=" + lon
                    + "&hourly=temperature_2m,precipitation_probability,weathercode&timezone=auto";
            JsonNode res = sendJsonGet(forecastUrl, WEATHER_REQUEST_TIMEOUT, "Open-Meteo forecast");
            JsonNode hourly = res.path("hourly");
            JsonNode timeArr = hourly.path("time");
            JsonNode tempArr = hourly.path("temperature_2m");
            JsonNode codeArr = hourly.path("weathercode");
            JsonNode popArr = hourly.path("precipitation_probability");

            if (!timeArr.isArray() || timeArr.isEmpty()) {
                return Map.of();
            }

            Map<LocalDate, Map<Integer, HourlyForecast>> result = new LinkedHashMap<>();
            for (int i = 0; i < timeArr.size(); i++) {
                String dateTimeStr = timeArr.get(i).asText();
                String[] parts = dateTimeStr.split("T");
                if (parts.length < 2) continue;
                Optional<LocalDate> dateOpt = parseDate(parts[0]);
                if (dateOpt.isEmpty()) continue;

                int hour = parseHour(parts[1]);
                double temp = tempArr.path(i).asDouble(20.0);
                int code = codeArr.path(i).asInt(0);
                int pop = popArr.path(i).asInt(0);

                String condition = wmoCodeToCondition(code);
                boolean isRainy = wmoCodeIsRainy(code) || pop >= 60;

                HourlyForecast item = new HourlyForecast(
                        parts[1].substring(0, Math.min(5, parts[1].length())),
                        hour, condition, Math.round(temp * 10.0) / 10.0, isRainy, pop
                );

                result.computeIfAbsent(dateOpt.get(), k -> new LinkedHashMap<>()).put(hour, item);
            }
            return result;
        } catch (Exception ex) {
            log.warn("Open-Meteo hourly weather lookup failed error={}", LogSanitizer.safeError(ex));
            return Map.of();
        }
    }

    private Map<LocalDate, ItineraryResponse.WeatherSummary> computeDailySummaries(
            Map<LocalDate, Map<Integer, HourlyForecast>> hourlyWeatherMap) {
        Map<LocalDate, ItineraryResponse.WeatherSummary> summaries = new LinkedHashMap<>();
        hourlyWeatherMap.forEach((date, map) -> {
            if (map == null || map.isEmpty()) return;
            double avgTemp = map.values().stream().mapToDouble(HourlyForecast::temperatureCelsius).average().orElse(20.0);
            List<String> conditions = map.values().stream().map(HourlyForecast::condition).toList();
            String mainCondition = mostCommon(conditions, "Clear");
            summaries.put(date, ItineraryResponse.WeatherSummary.builder()
                    .condition(mainCondition)
                    .temperatureCelsius(Math.round(avgTemp * 10.0) / 10.0)
                    .advice(weatherAdvice(mainCondition))
                    .build());
        });
        return summaries;
    }

    @SuppressWarnings("PMD.UnusedPrivateMethod")
    private Map<LocalDate, ItineraryResponse.WeatherSummary> fetchWeatherSummaries(GenerateItineraryRequest request) {
        Map<LocalDate, Map<Integer, HourlyForecast>> hourlyMap = fetchHourlyWeatherMap(request);
        return computeDailySummaries(hourlyMap);
    }

    private HourlyForecast findClosestHourlyForecast(Map<Integer, HourlyForecast> dayMap, int targetHour) {
        if (dayMap == null || dayMap.isEmpty()) return null;
        if (dayMap.containsKey(targetHour)) return dayMap.get(targetHour);
        for (int delta = 1; delta <= 12; delta++) {
            if (dayMap.containsKey(targetHour - delta)) return dayMap.get(targetHour - delta);
            if (dayMap.containsKey(targetHour + delta)) return dayMap.get(targetHour + delta);
        }
        return dayMap.values().iterator().next();
    }

    private int parseHour(String timeStr) {
        if (timeStr == null || timeStr.isBlank()) {
            return 12;
        }
        try {
            String clean = timeStr.trim().toUpperCase(Locale.ROOT);
            boolean isPm = clean.contains("PM");
            clean = clean.replaceAll("[^0-9:]", "");
            String[] parts = clean.split(":");
            if (parts.length > 0 && !parts[0].isBlank()) {
                int h = Integer.parseInt(parts[0]);
                if (isPm && h < 12) h += 12;
                if (!isPm && clean.contains("AM") && h == 12) h = 0;
                return Math.max(0, Math.min(23, h));
            }
        } catch (Exception ignored) {}
        return 12;
    }

    private String wmoCodeToCondition(int code) {
        return switch (code) {
            case 0 -> "Sunny";
            case 1, 2 -> "Partly Cloudy";
            case 3 -> "Overcast";
            case 45, 48 -> "Foggy";
            case 51, 53, 55 -> "Drizzle";
            case 56, 57 -> "Freezing Drizzle";
            case 61, 63, 65 -> "Rain";
            case 66, 67 -> "Freezing Rain";
            case 71, 73, 75, 77 -> "Snow";
            case 80, 81, 82 -> "Rain Showers";
            case 85, 86 -> "Snow Showers";
            case 95, 96, 99 -> "Thunderstorm";
            default -> "Clear";
        };
    }

    private JsonNode sendJsonGet(String url, Duration timeout, String description)
            throws IOException, InterruptedException {
        HttpRequest request = HttpRequest.newBuilder(URI.create(url))
                .timeout(timeout)
                .GET()
                .build();
        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() < 200 || response.statusCode() >= 300) {
            throw new IllegalStateException(description + " returned status " + response.statusCode());
        }
        return objectMapper.readTree(response.body());
    }

    private List<ItineraryResponse.TransportRecommendation> buildTransportRecommendations(
            List<ItineraryResponse.Activity> activities) {
        if (activities == null || activities.size() < 2) {
            return List.of();
        }

        List<ItineraryResponse.TransportRecommendation> recommendations = new ArrayList<>();
        for (int i = 0; i < activities.size() - 1; i++) {
            ItineraryResponse.Activity from = activities.get(i);
            ItineraryResponse.Activity to = activities.get(i + 1);
            fetchOsrmTransport(from, to).ifPresent(recommendations::add);
        }
        return recommendations;
    }

    private Optional<ItineraryResponse.TransportRecommendation> fetchOsrmTransport(
            ItineraryResponse.Activity from,
            ItineraryResponse.Activity to) {
        if (osrmBaseUrl == null || osrmBaseUrl.isBlank()
                || !hasValidCoordinates(from) || !hasValidCoordinates(to)) {
            return Optional.empty();
        }

        try {
            String routeUrl = trimTrailingSlash(osrmBaseUrl)
                    + "/route/v1/driving/"
                    + formatCoordinate(from.getLng()) + "," + formatCoordinate(from.getLat())
                    + ";"
                    + formatCoordinate(to.getLng()) + "," + formatCoordinate(to.getLat())
                    + "?overview=false";
            JsonNode routes = sendJsonGet(routeUrl, TRANSPORT_REQUEST_TIMEOUT, "OSRM route")
                    .path("routes");
            if (!routes.isArray() || routes.isEmpty()) {
                return Optional.empty();
            }

            JsonNode route = routes.get(0);
            double durationSeconds = route.path("duration").asDouble(-1);
            double distanceMeters = route.path("distance").asDouble(-1);
            if (durationSeconds < 0 || distanceMeters < 0) {
                return Optional.empty();
            }

            return Optional.of(ItineraryResponse.TransportRecommendation.builder()
                    .from(defaultString(from.getLocation(), from.getTitle()))
                    .to(defaultString(to.getLocation(), to.getTitle()))
                    .mode(distanceMeters <= 1200 ? "walk" : "route")
                    .estimatedDuration(formatRouteDuration(durationSeconds))
                    .notes("OSRM estimate: " + formatDistance(distanceMeters)
                            + ". Check live transit before departure.")
                    .build());
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            log.warn("Transport lookup interrupted");
            return Optional.empty();
        } catch (IOException | IllegalArgumentException | IllegalStateException ex) {
            log.warn("Transport lookup failed error={}", LogSanitizer.safeError(ex));
            return Optional.empty();
        } catch (Exception ex) {
            log.warn("Transport lookup failed error={}", LogSanitizer.safeError(ex));
            return Optional.empty();
        }
    }

    private ItineraryResponse.WeatherSummary unavailableWeather() {
        return ItineraryResponse.WeatherSummary.builder()
                .condition("Forecast unavailable")
                .temperatureCelsius(null)
                .advice("Check the local forecast closer to departure.")
                .build();
    }

    private boolean isUnavailableWeather(ItineraryResponse.WeatherSummary weather) {
        return weather != null
                && "Forecast unavailable".equalsIgnoreCase(defaultString(weather.getCondition(), ""));
    }

    private boolean isRainyWeather(ItineraryResponse.WeatherSummary weather) {
        if (weather == null || weather.getCondition() == null) {
            return false;
        }
        return isRainyCondition(weather.getCondition());
    }

    private boolean isRainyCondition(String condition) {
        if (condition == null || condition.isBlank()) return false;
        String cond = condition.toLowerCase(Locale.ROOT);
        return cond.contains("rain") || cond.contains("drizzle") || cond.contains("thunderstorm")
                || cond.contains("snow") || cond.contains("shower") || cond.contains("sleet");
    }

    private boolean wmoCodeIsRainy(int code) {
        return (code >= 51 && code <= 67) || (code >= 80 && code <= 82) || (code >= 95 && code <= 99);
    }

    private boolean isOutdoorActivity(ItineraryResponse.Activity activity) {
        if (activity == null) return false;
        String category = defaultString(activity.getCategory(), "").toUpperCase();
        if ("NATURE".equals(category) || "BEACH".equals(category) || "OUTDOOR".equals(category)) {
            return true;
        }
        String text = (defaultString(activity.getTitle(), "") + " " + defaultString(activity.getDescription(), "")).toLowerCase();
        return text.contains("park") || text.contains("garden") || text.contains("walking tour")
                || text.contains("hiking") || text.contains("beach") || text.contains("viewpoint")
                || text.contains("outdoor");
    }

    private void adaptOutdoorActivityToIndoor(ItineraryResponse.Activity activity) {
        activity.setCategory("CULTURE");
        if (activity.getTitle() != null && !activity.getTitle().toLowerCase().contains("indoor")) {
            activity.setTitle("Indoor Cultural & Museum Tour: " + activity.getTitle());
        }
        String origDesc = defaultString(activity.getDescription(), "");
        activity.setDescription(origDesc + " (Adapted for rainy weather: shifted to indoor exhibits & galleries.)");
        String origTips = defaultString(activity.getTips(), "");
        activity.setTips((origTips.isBlank() ? "" : origTips + " ") + "Weather adaptation: Indoor venue selected due to forecasted rain.");
    }

    private String weatherAdvice(String condition) {
        String normalized = condition == null ? "" : condition.toLowerCase();
        if (normalized.contains("rain")) {
            return "Carry an umbrella and keep indoor backups ready.";
        }
        if (normalized.contains("snow")) {
            return "Wear warm layers and allow extra transport time.";
        }
        if (normalized.contains("clear")) {
            return "Bring sunscreen and water for outdoor stops.";
        }
        return "Keep the day flexible and confirm conditions before leaving.";
    }

    private Optional<LocalDate> parseDate(String value) {
        if (value == null || value.isBlank()) {
            return Optional.empty();
        }
        try {
            return Optional.of(LocalDate.parse(value));
        } catch (DateTimeParseException ex) {
            return Optional.empty();
        }
    }

    private String defaultString(String value, String fallback) {
        return value != null && !value.isBlank() ? value : fallback;
    }

    private String appendQuery(String baseUrl, String query) {
        return baseUrl + (baseUrl.contains("?") ? "&" : "?") + query;
    }

    private String encodeQueryParam(String value) {
        return URLEncoder.encode(value == null ? "" : value, StandardCharsets.UTF_8);
    }

    private String googleMapsDirectionsUrl(String query) {
        return "https://www.google.com/maps/dir/?api=1&destination=" + encodeQueryParam(query);
    }

    private boolean hasValidCoordinates(ItineraryResponse.Activity activity) {
        return activity != null
                && isValidLatitude(activity.getLat())
                && isValidLongitude(activity.getLng());
    }

    private boolean isValidLatitude(Double value) {
        return value != null && !value.isNaN() && value >= -90 && value <= 90;
    }

    private boolean isValidLongitude(Double value) {
        return value != null && !value.isNaN() && value >= -180 && value <= 180;
    }

    private String formatCoordinate(Double value) {
        return String.format(Locale.ROOT, "%.6f", value);
    }

    private String trimTrailingSlash(String value) {
        String trimmed = value.trim();
        while (trimmed.endsWith("/")) {
            trimmed = trimmed.substring(0, trimmed.length() - 1);
        }
        return trimmed;
    }

    private String formatRouteDuration(double durationSeconds) {
        long minutes = Math.max(1, Math.round(durationSeconds / 60.0));
        if (minutes < 60) {
            return minutes + " " + pluralize("min", minutes);
        }
        long hours = minutes / 60;
        long remainingMinutes = minutes % 60;
        if (remainingMinutes == 0) {
            return hours + " " + pluralize("hour", hours);
        }
        return hours + " " + pluralize("hour", hours) + " " + remainingMinutes + " min";
    }

    private String formatDistance(double distanceMeters) {
        if (distanceMeters < 1000) {
            return Math.round(distanceMeters) + " m";
        }
        double kilometers = distanceMeters / 1000.0;
        return String.format(Locale.ROOT, "%.1f km", kilometers);
    }

    private String mostCommon(List<String> values, String fallback) {
        return values.stream()
                .filter(Objects::nonNull)
                .map(String::trim)
                .filter(value -> !value.isBlank())
                .collect(Collectors.groupingBy(value -> value, LinkedHashMap::new, Collectors.counting()))
                .entrySet()
                .stream()
                .max(Comparator.comparingLong(Map.Entry::getValue))
                .map(Map.Entry::getKey)
                .orElse(fallback);
    }

    private List<String> valuesMentionedByMultipleTravelers(List<String> rawValues) {
        Map<String, Long> counts = rawValues.stream()
                .filter(Objects::nonNull)
                .map(String::trim)
                .filter(value -> !value.isBlank())
                .collect(Collectors.groupingBy(
                        value -> value.toLowerCase(),
                        LinkedHashMap::new,
                        Collectors.counting()));
        Map<String, String> labels = rawValues.stream()
                .filter(Objects::nonNull)
                .map(String::trim)
                .filter(value -> !value.isBlank())
                .collect(Collectors.toMap(
                        value -> value.toLowerCase(),
                        value -> value,
                        (first, ignored) -> first,
                        LinkedHashMap::new));

        List<String> shared = counts.entrySet().stream()
                .filter(entry -> entry.getValue() > 1)
                .map(entry -> labels.get(entry.getKey()))
                .toList();

        if (!shared.isEmpty()) {
            return shared;
        }
        return labels.values().stream().limit(5).toList();
    }

    private List<ConsolidatedPreferencesResponse.Conflict> detectPreferenceConflicts(
            List<GroupPreferenceRequest.UserPreference> preferences) {
        Map<String, String> mustSee = new LinkedHashMap<>();
        Map<String, String> avoid = new LinkedHashMap<>();

        for (GroupPreferenceRequest.UserPreference preference : preferences) {
            safeTextList(preference.mustSee()).forEach(value -> mustSee.putIfAbsent(value.toLowerCase(), value));
            safeTextList(preference.avoid()).forEach(value -> avoid.putIfAbsent(value.toLowerCase(), value));
        }

        List<ConsolidatedPreferencesResponse.Conflict> conflicts = new ArrayList<>();
        mustSee.forEach((key, label) -> {
            if (avoid.containsKey(key)) {
                conflicts.add(new ConsolidatedPreferencesResponse.Conflict(
                        label,
                        label + " appears in both must-see and avoid preferences."));
            }
        });
        return conflicts;
    }

    private <T> List<T> safeList(List<T> values) {
        return values == null ? List.of() : values.stream()
                .filter(Objects::nonNull)
                .toList();
    }

    private List<String> safeTextList(List<String> values) {
        return safeList(values).stream()
                .map(String::trim)
                .filter(value -> !value.isBlank())
                .toList();
    }

    private String buildSuggestedGroupPrompt(String budget, String pace, List<String> interests,
                                             List<String> mustSee,
                                             List<ConsolidatedPreferencesResponse.Conflict> conflicts) {
        StringBuilder prompt = new StringBuilder();
        prompt.append("Create a ").append(pace.toLowerCase()).append(" itinerary with a ")
                .append(budget.toLowerCase()).append(" budget.");
        if (!interests.isEmpty()) {
            prompt.append(" Prioritize ").append(String.join(", ", interests)).append(".");
        }
        if (!mustSee.isEmpty()) {
            prompt.append(" Include ").append(String.join(", ", mustSee)).append(".");
        }
        if (!conflicts.isEmpty()) {
            prompt.append(" Resolve group conflicts around ")
                    .append(conflicts.stream()
                            .map(ConsolidatedPreferencesResponse.Conflict::topic)
                            .collect(Collectors.joining(", ")))
                    .append(" with balanced alternatives.");
        }
        return prompt.toString();
    }

    // -------------------------------------------------------------------------
    // Utility
    // -------------------------------------------------------------------------

    private String fallbackReason(Throwable ex) {
        if (ex instanceof FallbackTriggerException fallbackTriggerException) {
            return fallbackTriggerException.reason();
        }
        if (isTimeoutException(ex)) {
            return AI_TIMEOUT;
        }
        if (isRateLimitException(ex)) {
            return AI_RATE_LIMITED;
        }
        if (isJsonProcessingException(ex)) {
            return AI_MALFORMED_RESPONSE;
        }
        return AI_PROVIDER_UNAVAILABLE;
    }

    private String requestAiWithRetry(String prompt, int maxAttempts, Duration timeout) {
        RuntimeException lastFailure = null;

        for (int attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                return requestAiWithTimeout(prompt, timeout);
            } catch (AiServiceTimeoutException ex) {
                throw ex;
            } catch (RuntimeException ex) {
                lastFailure = ex;
                if (!isRateLimitException(ex) || attempt == maxAttempts) {
                    throw ex;
                }
                sleepBeforeRetry(attempt);
            }
        }

        throw lastFailure == null
                ? new RuntimeException("AI request failed")
                : lastFailure;
    }

    private String requestAiWithTimeout(String prompt, Duration timeout) {
        Future<String> future = aiBlockingExecutor.submit(() -> requestAi(prompt));
        try {
            return future.get(timeout.toMillis(), TimeUnit.MILLISECONDS);
        } catch (TimeoutException ex) {
            future.cancel(true);
            throw new AiServiceTimeoutException(timeoutMessage(timeout), ex);
        } catch (InterruptedException ex) {
            future.cancel(true);
            Thread.currentThread().interrupt();
            throw new RuntimeException("AI request was interrupted", ex);
        } catch (ExecutionException ex) {
            Throwable cause = ex.getCause();
            if (cause instanceof RuntimeException runtimeException) {
                if (isTimeoutException(runtimeException)) {
                    throw new AiServiceTimeoutException(timeoutMessage(timeout), runtimeException);
                }
                throw runtimeException;
            }
            throw new RuntimeException("AI request failed", cause);
        }
    }

    private static String timeoutMessage(Duration timeout) {
        return "AI itinerary generation timed out after " + formatDuration(timeout);
    }

    private static String formatDuration(Duration timeout) {
        long seconds = timeout.getSeconds();
        if (!timeout.isZero() && timeout.toNanosPart() == 0 && seconds > 0) {
            return seconds + " " + pluralize("second", seconds);
        }

        long milliseconds = timeout.toMillis();
        if (milliseconds > 0) {
            return milliseconds + " " + pluralize("millisecond", milliseconds);
        }

        long nanoseconds = timeout.toNanos();
        return nanoseconds + " " + pluralize("nanosecond", nanoseconds);
    }

    private static String pluralize(String unit, long amount) {
        return amount == 1 ? unit : unit + "s";
    }

    private void sleepBeforeRetry(int attempt) {
        try {
            Thread.sleep(Math.min(2000L, 500L * attempt));
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            throw new RuntimeException("Interrupted while retrying rate-limited AI request", ex);
        }
    }

    private boolean isRateLimitException(Throwable ex) {
        Throwable cause = ex;
        while (cause != null) {
            String message = cause.getMessage();
            if (message != null) {
                String normalized = message.toLowerCase(Locale.ROOT);
                if (normalized.contains("429")
                        || normalized.contains("rate limit")
                        || normalized.contains("too many requests")) {
                    return true;
                }
            }
            cause = cause.getCause();
        }
        return false;
    }

    private boolean isTimeoutException(Throwable ex) {
        Throwable cause = ex;
        while (cause != null) {
            if (cause instanceof TimeoutException || cause instanceof HttpTimeoutException) {
                return true;
            }
            String message = cause.getMessage();
            if (message != null) {
                String normalized = message.toLowerCase(Locale.ROOT);
                if (normalized.contains("timed out") || normalized.contains("timeout")) {
                    return true;
                }
            }
            cause = cause.getCause();
        }
        return false;
    }

    private boolean isJsonProcessingException(Throwable ex) {
        Throwable cause = ex;
        while (cause != null) {
            if (cause instanceof JsonProcessingException) {
                return true;
            }
            cause = cause.getCause();
        }
        return false;
    }

    private String requestAi(String prompt) {
        try {
            return chatClient.prompt()
                    .user(prompt)
                    .call()
                    .content();
        } catch (Exception ex) {
            log.warn("Spring AI call failed, falling back to direct Groq API error={}",
                    LogSanitizer.safeError(ex));
            return callGroqDirect(prompt);
        }
    }

    private String writeJson(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException ex) {
            return "[]";
        }
    }

    /**
     * Strips markdown code fences if the model wraps its JSON in ```json ... ```
     * Handles both JSON objects {@code {...}} and arrays {@code [...]}.
     */
    private String extractJson(String raw) {
        if (raw == null || raw.isBlank()) return "{}";
        String trimmed = raw.strip();
        // Strip markdown code fences: ```json ... ``` or ``` ... ```
        if (trimmed.startsWith("```")) {
            int start = trimmed.indexOf('\n') + 1;
            int end = trimmed.lastIndexOf("```");
            if (end > start) {
                trimmed = trimmed.substring(start, end).strip();
            }
        }
        // Handle JSON arrays [...] as well as objects {...}
        int objStart = trimmed.indexOf('{');
        int arrStart = trimmed.indexOf('[');
        if (objStart >= 0 && (arrStart < 0 || objStart < arrStart)) {
            int objEnd = trimmed.lastIndexOf('}');
            if (objEnd > objStart) return trimmed.substring(objStart, objEnd + 1);
        } else if (arrStart >= 0) {
            int arrEnd = trimmed.lastIndexOf(']');
            if (arrEnd > arrStart) return trimmed.substring(arrStart, arrEnd + 1);
        }
        return trimmed;
    }

    private String historyStatus(ItineraryResponse response) {
        return Boolean.TRUE.equals(response.getFallbackUsed()) ? "FALLBACK" : "SUCCESS";
    }

    private void saveGenerationHistory(GenerateItineraryRequest request, ItineraryResponse response,
                                       String prompt, String status) {
        try {
            TripConstraints constraints = request.constraints();
            GenerationHistory history = GenerationHistory.builder()
                    .generationId(response.getGenerationId())
                    .tripId(request.tripId())
                    .destination(constraints.destination())
                    .startDate(constraints.startDate())
                    .endDate(constraints.endDate())
                    .promptHash(hashPrompt(prompt))
                    .fallbackUsed(Boolean.TRUE.equals(response.getFallbackUsed()))
                    .status(status)
                    .requestPayload(objectMapper.convertValue(request, new TypeReference<Map<String, Object>>() {}))
                    .responsePayload(objectMapper.convertValue(response, new TypeReference<Map<String, Object>>() {}))
                    .build();
            generationHistoryRepository.save(history);
        } catch (Exception ex) {
            log.warn("Failed to persist itinerary generation history error={}", LogSanitizer.safeError(ex));
        }
    }

    private void updateGenerationHistory(GenerationHistory history, GenerateItineraryRequest request,
                                         ItineraryResponse response, String prompt) {
        TripConstraints constraints = request.constraints();
        history.setTripId(request.tripId());
        history.setDestination(constraints.destination());
        history.setStartDate(constraints.startDate());
        history.setEndDate(constraints.endDate());
        history.setPromptHash(hashPrompt(prompt));
        history.setFallbackUsed(Boolean.TRUE.equals(response.getFallbackUsed()));
        history.setRetryCount(history.getRetryCount() + 1);
        history.setStatus(historyStatus(response));
        history.setRequestPayload(objectMapper.convertValue(request, new TypeReference<Map<String, Object>>() {}));
        history.setResponsePayload(objectMapper.convertValue(response, new TypeReference<Map<String, Object>>() {}));
        generationHistoryRepository.save(history);
    }

    private String hashPrompt(String prompt) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(prompt.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (NoSuchAlgorithmException ex) {
            return Integer.toHexString(prompt.hashCode());
        }
    }

    private record ItineraryGenerationResult(ItineraryResponse response, String prompt) {
    }

    private static class ProviderConfig {
        final String name;
        final String apiKey;
        final String baseUrl;
        final String model;

        ProviderConfig(String name, String apiKey, String baseUrl, String model) {
            this.name = name;
            this.apiKey = apiKey;
            this.baseUrl = baseUrl;
            this.model = model;
        }
    }

    private String callGroqDirect(String prompt) {
        List<ProviderConfig> providers = new ArrayList<>();

        // 1. Groq Primary
        String key0 = (groqApiKey == null || groqApiKey.isBlank()) ? System.getenv("GROQ_API_KEY") : groqApiKey;
        String url0 = (groqBaseUrl == null || groqBaseUrl.isBlank()) ? "https://api.groq.com/openai" : groqBaseUrl;
        String model0 = (groqModel == null || groqModel.isBlank()) ? "llama-3.3-70b-versatile" : groqModel;
        providers.add(new ProviderConfig("Groq Primary", key0, url0, model0));

        // 2. Groq Secondary
        String key1 = (groqApiKey1 == null || groqApiKey1.isBlank()) ? System.getenv("GROQ_API_KEY1") : groqApiKey1;
        providers.add(new ProviderConfig("Groq Secondary", key1, url0, model0));

        // 3. OpenCode
        String key2 = (opencodeApiKey == null || opencodeApiKey.isBlank()) ? System.getenv("Opencode_API_KEY") : opencodeApiKey;
        String url2 = (opencodeBaseUrl == null || opencodeBaseUrl.isBlank()) ? "https://opencode.ai/zen/go/v1" : opencodeBaseUrl;
        String model2 = (opencodeModel == null || opencodeModel.isBlank()) ? "openai/gpt-4o" : opencodeModel;
        providers.add(new ProviderConfig("OpenCode", key2, url2, model2));

        List<ProviderConfig> activeProviders = new ArrayList<>();
        for (ProviderConfig p : providers) {
            if (p.apiKey != null && !p.apiKey.isBlank()) {
                activeProviders.add(p);
            }
        }

        if (activeProviders.isEmpty()) {
            throw new IllegalStateException("No AI provider API keys are configured (all keys are empty).");
        }

        // Cool-off check: if activeProviderIndex is not 0, check if we should reset it
        long now = System.currentTimeMillis();
        int currentIndex = activeProviderIndex.get();
        if (currentIndex != 0 && now - lastFailureTime.get() > 300_000) { // 5 minutes cool-off
            log.info("Cooldown period of 5 minutes elapsed. Resetting active provider to primary (0).");
            activeProviderIndex.set(0);
            currentIndex = 0;
        }

        int startIndex = currentIndex % activeProviders.size();
        Exception lastException = null;

        for (int i = 0; i < activeProviders.size(); i++) {
            int attemptIndex = (startIndex + i) % activeProviders.size();
            ProviderConfig provider = activeProviders.get(attemptIndex);

            log.info("Attempting AI generation with provider: {} (index: {})", provider.name, attemptIndex);

            try {
                String result = executeChatCompletion(provider, prompt);
                // If we succeeded and we used a fallback index, log that we used fallback and stick to it
                if (attemptIndex != activeProviderIndex.get()) {
                    log.info("Successfully recovered using AI provider: {} (new sticky index: {})", provider.name, attemptIndex);
                    activeProviderIndex.set(attemptIndex);
                }
                return result;
            } catch (Exception ex) {
                log.warn("AI provider {} failed (index: {}). Error: {}", provider.name, attemptIndex, ex.getMessage());
                lastException = ex;
                lastFailureTime.set(System.currentTimeMillis());
                // Switch sticky index to next available index immediately
                int nextIndex = (attemptIndex + 1) % activeProviders.size();
                activeProviderIndex.set(nextIndex);
            }
        }

        if (lastException instanceof AiServiceTimeoutException) {
            throw (AiServiceTimeoutException) lastException;
        }
        throw new RuntimeException("All fallback AI providers failed.", lastException);
    }

    private String executeChatCompletion(ProviderConfig provider, String prompt) throws Exception {
        String endpoint = provider.baseUrl.endsWith("/")
                ? provider.baseUrl + "v1/chat/completions"
                : provider.baseUrl + "/v1/chat/completions";

        Map<String, Object> payload = Map.of(
                "model", provider.model,
                "messages", List.of(
                        Map.of("role", "system", "content", "You are Trippy AI, a helpful travel planning assistant."),
                        Map.of("role", "user", "content", prompt)
                )
        );

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(endpoint))
                .timeout(ITINERARY_TIMEOUT)
                .header("Authorization", "Bearer " + provider.apiKey)
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(payload)))
                .build();

        try {
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                throw new IllegalStateException("API returned status " + response.statusCode() + ": " + response.body());
            }

            JsonNode root = objectMapper.readTree(response.body());
            JsonNode content = root.path("choices").path(0).path("message").path("content");
            if (content.isMissingNode() || content.asText().isBlank()) {
                throw new RuntimeException("API returned empty content");
            }
            return content.asText();
        } catch (HttpTimeoutException ex) {
            throw new AiServiceTimeoutException(timeoutMessage(ITINERARY_TIMEOUT), ex);
        }
    }

    private static class FallbackTriggerException extends RuntimeException {
        private final String reason;

        FallbackTriggerException(String reason, String message) {
            super(message);
            this.reason = reason;
        }

        FallbackTriggerException(String reason, String message, Throwable cause) {
            super(message, cause);
            this.reason = reason;
        }

        String reason() {
            return reason;
        }
    }
}
