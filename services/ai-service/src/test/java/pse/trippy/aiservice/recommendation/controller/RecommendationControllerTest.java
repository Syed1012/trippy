package pse.trippy.aiservice.recommendation.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import pse.trippy.aiservice.recommendation.dto.RecommendationRequest;
import pse.trippy.aiservice.recommendation.dto.RecommendationResponse;
import pse.trippy.aiservice.recommendation.dto.RecommendationResponse.DayRecommendations;
import pse.trippy.aiservice.recommendation.dto.RecommendationResponse.RecommendationOption;
import pse.trippy.aiservice.recommendation.service.ItineraryRecommendationService;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(RecommendationController.class)
@DisplayName("RecommendationController")
class RecommendationControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private ItineraryRecommendationService recommendationService;

    private RecommendationResponse stub(UUID tripId) {
        return new RecommendationResponse(tripId, "llama3.2:3b", "AI", Instant.now(), List.of(
                new DayRecommendations(1, List.of(new RecommendationOption(
                        UUID.randomUUID(), "Top Pick", "Louvre & Seine", "09:00", "17:00",
                        BigDecimal.valueOf(80), "EUR", "https://maps.example/louvre", "Art and river.",
                        "Louvre Museum, Paris")))));
    }

    @Test
    @DisplayName("POST /ai/recommendations → 200 with grouped days")
    void generate_returns200() throws Exception {
        UUID tripId = UUID.randomUUID();
        when(recommendationService.generate(any())).thenReturn(stub(tripId));

        RecommendationRequest request = new RecommendationRequest(tripId, "Paris, France", 2, null, null, null);

        mockMvc.perform(post("/ai/recommendations")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.source").value("AI"))
                .andExpect(jsonPath("$.days[0].options[0].vibe").value("Top Pick"));
    }

    @Test
    @DisplayName("POST /ai/recommendations with a blank destination → 400")
    void generate_blankDestination_returns400() throws Exception {
        RecommendationRequest request = new RecommendationRequest(UUID.randomUUID(), "  ", 2, null, null, null);

        mockMvc.perform(post("/ai/recommendations")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("GET /ai/recommendations/{tripId} → 200 with stored days")
    void getStored_returns200() throws Exception {
        UUID tripId = UUID.randomUUID();
        when(recommendationService.getStored(any())).thenReturn(stub(tripId));

        mockMvc.perform(get("/ai/recommendations/{tripId}", tripId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.days[0].dayNumber").value(1));
    }
}
