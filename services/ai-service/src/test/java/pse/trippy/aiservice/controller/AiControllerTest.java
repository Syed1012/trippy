package pse.trippy.aiservice.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import pse.trippy.aiservice.dto.request.DestinationSuggestionRequest;
import pse.trippy.aiservice.dto.request.GenerateItineraryRequest;
import pse.trippy.aiservice.dto.request.GroupPreferenceRequest;
import pse.trippy.aiservice.dto.request.TravelAdviceRequest;
import pse.trippy.aiservice.dto.request.TripConstraints;
import pse.trippy.aiservice.dto.response.AiUsageResponse;
import pse.trippy.aiservice.dto.response.ConsolidatedPreferencesResponse;
import pse.trippy.aiservice.dto.response.DestinationSuggestion;
import pse.trippy.aiservice.dto.response.DestinationSuggestionResponse;
import pse.trippy.aiservice.dto.response.ItineraryResponse;
import pse.trippy.aiservice.dto.response.TravelAdviceResponse;
import pse.trippy.aiservice.service.AiService;
import pse.trippy.aiservice.service.AiUsageService;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(AiController.class)
@DisplayName("AiController")
class AiControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private AiService aiService;

    @MockBean
    private AiUsageService aiUsageService;

    // =========================================================================
    // POST /ai/destination-suggestions
    // =========================================================================

    @Test
    @DisplayName("POST /ai/destination-suggestions → 200 with suggestions")
    void destinationSuggestions_returns200() throws Exception {
        DestinationSuggestionResponse stubResponse = new DestinationSuggestionResponse(
                List.of(new DestinationSuggestion(
                        "Lisbon, Portugal",
                        "Portugal",
                        "Affordable and sunny with beautiful coastline.",
                        List.of("Belem Tower", "Trams", "Alfama"),
                        BigDecimal.valueOf(100),
                        "May to September",
                        "https://www.google.com/maps/dir/?api=1&destination=Lisbon%2C+Portugal",
                        0.92)),
                Instant.now(),
                false);

        when(aiService.suggestDestinations(any())).thenReturn(stubResponse);

        DestinationSuggestionRequest request = new DestinationSuggestionRequest(
                null, null, List.of("beach", "culture"), "LOW", null, 7, "Europe", "August",
                null, null, null, null);

        mockMvc.perform(post("/ai/destination-suggestions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.suggestions[0].destination").value("Lisbon, Portugal"))
                .andExpect(jsonPath("$.suggestions[0].matchScore").value(0.92));
    }

    // =========================================================================
    // POST /ai/travel-advice
    // =========================================================================

    @Test
    @DisplayName("POST /ai/travel-advice → 200 with advice")
    void travelAdvice_returns200() throws Exception {
        TravelAdviceResponse stubResponse = TravelAdviceResponse.builder()
                .answer("Take the Shinkansen — it takes ~2h 15m.")
                .relatedQuestions(List.of("What JR Pass is best?"))
                .generatedAt(Instant.now())
                .build();

        when(aiService.getTravelAdvice(any())).thenReturn(stubResponse);

        TravelAdviceRequest request = new TravelAdviceRequest();
        request.setQuestion("Best way to travel from Tokyo to Kyoto?");
        request.setDestination("Japan");

        mockMvc.perform(post("/ai/travel-advice")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.answer").value("Take the Shinkansen — it takes ~2h 15m."))
                .andExpect(jsonPath("$.relatedQuestions[0]").value("What JR Pass is best?"));
    }

    @Test
    @DisplayName("POST /ai/travel-advice → 400 when required fields are missing")
    void travelAdvice_returns400OnMissingFields() throws Exception {
        TravelAdviceRequest request = new TravelAdviceRequest();
        // question and destination not set

        mockMvc.perform(post("/ai/travel-advice")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest());
    }

    // =========================================================================
    // POST /ai/itineraries
    // =========================================================================

    @Test
    @DisplayName("POST /ai/itineraries → 200 with itinerary")
    void generateItinerary_returns200() throws Exception {
        ItineraryResponse stubResponse = ItineraryResponse.builder()
                .generationId(UUID.fromString("123e4567-e89b-12d3-a456-426614174000"))
                .tripTitle("5 Days in Kyoto")
                .summary("Culture and temples")
                .dailyPlan(List.of(
                        ItineraryResponse.DayPlan.builder()
                                .dayNumber(1)
                                .date("2026-09-01")
                                .title("Arrival & Fushimi Inari")
                                .activities(List.of())
                                .build()))
                .packingTips(List.of("Comfortable shoes"))
                .travelTips(List.of("Get IC card"))
                .generatedAt(Instant.now())
                .build();

        when(aiService.generateItinerary(any())).thenReturn(stubResponse);

        GenerateItineraryRequest request = new GenerateItineraryRequest(
                null,
                new TripConstraints("Kyoto, Japan", LocalDate.of(2026, 9, 1), LocalDate.of(2026, 9, 5),
                        null, null, null),
                null, null, null);

        mockMvc.perform(post("/ai/itineraries")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.generationId").value("123e4567-e89b-12d3-a456-426614174000"))
                .andExpect(jsonPath("$.tripTitle").value("5 Days in Kyoto"))
                .andExpect(jsonPath("$.dailyPlan[0].dayNumber").value(1))
                .andExpect(jsonPath("$.packingTips[0]").value("Comfortable shoes"));
    }

    @Test
    @DisplayName("POST /ai/itinerary/generate → 200 with itinerary")
    void generateItineraryAlias_returns200() throws Exception {
        ItineraryResponse stubResponse = ItineraryResponse.builder()
                .generationId(UUID.fromString("123e4567-e89b-12d3-a456-426614174001"))
                .tripTitle("5 Days in Kyoto")
                .summary("Culture and temples")
                .dailyPlan(List.of())
                .generatedAt(Instant.now())
                .build();

        when(aiService.generateItinerary(any())).thenReturn(stubResponse);

        GenerateItineraryRequest request = new GenerateItineraryRequest(
                null,
                new TripConstraints("Kyoto, Japan", LocalDate.of(2026, 9, 1), LocalDate.of(2026, 9, 5),
                        null, null, null),
                null, null, null);

        mockMvc.perform(post("/ai/itinerary/generate")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.generationId").value("123e4567-e89b-12d3-a456-426614174001"));
    }

    @Test
    @DisplayName("POST /ai/itineraries accepts past dates and ECONOMY budget")
    void generateItinerary_acceptsPastDatesAndEconomyBudget() throws Exception {
        ItineraryResponse stubResponse = ItineraryResponse.builder()
                .generationId(UUID.fromString("123e4567-e89b-12d3-a456-426614174002"))
                .tripTitle("Archived Kyoto Trip")
                .dailyPlan(List.of())
                .generatedAt(Instant.now())
                .build();

        when(aiService.generateItinerary(any())).thenReturn(stubResponse);

        GenerateItineraryRequest request = new GenerateItineraryRequest(
                null,
                new TripConstraints("Kyoto, Japan", LocalDate.of(2025, 1, 1), LocalDate.of(2025, 1, 5),
                        "ECONOMY", new TripConstraints.Travelers(1, 0), null),
                null, null, null);

        mockMvc.perform(post("/ai/itineraries")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.generationId").value("123e4567-e89b-12d3-a456-426614174002"));
    }

    @Test
    @DisplayName("POST /ai/itineraries rejects invalid traveler counts")
    void generateItinerary_rejectsInvalidTravelerCounts() throws Exception {
        GenerateItineraryRequest request = new GenerateItineraryRequest(
                null,
                new TripConstraints("Kyoto, Japan", LocalDate.of(2026, 9, 1), LocalDate.of(2026, 9, 5),
                        "MODERATE", new TripConstraints.Travelers(0, -1), null),
                null, null, null);

        mockMvc.perform(post("/ai/itineraries")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("POST /ai/preferences/consolidate → 200 with consolidated preferences")
    void consolidatePreferences_returns200() throws Exception {
        ConsolidatedPreferencesResponse stubResponse = new ConsolidatedPreferencesResponse(
                "MODERATE",
                "SLOW",
                List.of("food"),
                List.of("Louvre"),
                List.of(),
                "Create a slow itinerary with a moderate budget.");

        when(aiService.consolidatePreferences(any())).thenReturn(stubResponse);

        GroupPreferenceRequest request = new GroupPreferenceRequest(
                UUID.randomUUID(),
                List.of(new GroupPreferenceRequest.UserPreference(
                        UUID.randomUUID(),
                        List.of("food"),
                        "MODERATE",
                        "SLOW",
                        List.of("Louvre"),
                        List.of())));

        mockMvc.perform(post("/ai/preferences/consolidate")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.recommendedBudget").value("MODERATE"))
                .andExpect(jsonPath("$.sharedInterests[0]").value("food"));
    }

    @Test
    @DisplayName("GET /ai/usage/{userId} → 200 with usage details")
    void getUsage_byPathVariable_returns200() throws Exception {
        UUID userId = UUID.randomUUID();
        AiUsageResponse stubResponse = new AiUsageResponse(userId, 5L, java.util.Map.of("CHAT", 5L), Instant.now(), 500L);

        when(aiUsageService.getUsage(userId)).thenReturn(stubResponse);

        mockMvc.perform(get("/ai/usage/" + userId)
                        .header("X-User-Id", userId.toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.userId").value(userId.toString()))
                .andExpect(jsonPath("$.totalRequests").value(5))
                .andExpect(jsonPath("$.tokensConsumed").value(500));
    }

    @Test
    @DisplayName("GET /ai/usage with header → 200 with usage details")
    void getUsage_byHeader_returns200() throws Exception {
        UUID userId = UUID.randomUUID();
        AiUsageResponse stubResponse = new AiUsageResponse(userId, 5L, java.util.Map.of("CHAT", 5L), Instant.now(), 500L);

        when(aiUsageService.getUsage(userId)).thenReturn(stubResponse);

        mockMvc.perform(get("/ai/usage")
                        .header("X-User-Id", userId.toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.userId").value(userId.toString()));
    }

    @Test
    @DisplayName("GET /ai/usage with matching query param → 200 with usage details")
    void getUsage_byQueryParam_returns200() throws Exception {
        UUID userId = UUID.randomUUID();
        AiUsageResponse stubResponse = new AiUsageResponse(userId, 5L, java.util.Map.of("CHAT", 5L), Instant.now(), 500L);

        when(aiUsageService.getUsage(userId)).thenReturn(stubResponse);

        mockMvc.perform(get("/ai/usage")
                        .header("X-User-Id", userId.toString())
                        .param("userId", userId.toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.userId").value(userId.toString()));
    }

    @Test
    @DisplayName("GET /ai/usage with no authenticated user ID → 400 Bad Request")
    void getUsage_missingUserId_returns400() throws Exception {
        mockMvc.perform(get("/ai/usage"))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("GET /ai/usage rejects a different user ID")
    void getUsage_rejectsDifferentUserId() throws Exception {
        mockMvc.perform(get("/ai/usage/" + UUID.randomUUID())
                        .header("X-User-Id", UUID.randomUUID().toString()))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("POST /ai/itineraries/{generationId}/retry returns 409 at the retry limit")
    void retryItinerary_returnsConflictAtRetryLimit() throws Exception {
        UUID generationId = UUID.randomUUID();
        when(aiService.retryItinerary(generationId))
                .thenThrow(new IllegalStateException("Maximum retry attempts reached for this generation"));

        mockMvc.perform(post("/ai/itineraries/" + generationId + "/retry"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.status").value(409));
    }
}
