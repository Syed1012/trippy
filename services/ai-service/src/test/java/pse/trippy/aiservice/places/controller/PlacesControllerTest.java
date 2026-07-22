package pse.trippy.aiservice.places.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import pse.trippy.aiservice.places.dto.PlaceInsightsRequest;
import pse.trippy.aiservice.places.dto.PlaceInsightsRequest.PlaceRef;
import pse.trippy.aiservice.places.dto.PlaceInsightsResponse;
import pse.trippy.aiservice.places.dto.PlaceInsightsResponse.PlaceInsight;
import pse.trippy.aiservice.places.dto.PlaceInsightsResponse.Review;
import pse.trippy.aiservice.places.dto.PlaceRankRequest;
import pse.trippy.aiservice.places.dto.PlaceRankRequest.RankPlace;
import pse.trippy.aiservice.places.dto.PlaceRankResponse;
import pse.trippy.aiservice.places.dto.PlaceRankResponse.Ranking;
import pse.trippy.aiservice.places.service.PlaceInsightsService;

import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(PlacesController.class)
@DisplayName("PlacesController")
class PlacesControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private PlaceInsightsService placeInsightsService;

    @Test
    @DisplayName("POST /ai/places/insights → 200 with per-place reviews")
    void insights_returns200() throws Exception {
        when(placeInsightsService.insights(any())).thenReturn(new PlaceInsightsResponse(
                "AI", "llama3.2:3b", List.of(new PlaceInsight("p1", 4.5, 230, List.of(
                        new Review("Lena", 5, "2 weeks ago", "Best flat white in town."))))));

        PlaceInsightsRequest request = new PlaceInsightsRequest(
                List.of(new PlaceRef("p1", "Café Central", "cafe", "Ludwigsburg")));

        mockMvc.perform(post("/ai/places/insights")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.source").value("AI"))
                .andExpect(jsonPath("$.places[0].id").value("p1"))
                .andExpect(jsonPath("$.places[0].reviews[0].author").value("Lena"));
    }

    @Test
    @DisplayName("POST /ai/places/insights → 400 when places list is empty")
    void insights_rejectsEmpty() throws Exception {
        mockMvc.perform(post("/ai/places/insights")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"places\":[]}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("POST /ai/places/rank → 200 with top-3 rankings")
    void rank_returns200() throws Exception {
        when(placeInsightsService.rank(any())).thenReturn(new PlaceRankResponse(
                "AI", "llama3.2:3b", "Bohnenwerk edges it.",
                List.of(new Ranking("p3", 1, "Bohnenwerk", "Highest rated."))));

        PlaceRankRequest request = new PlaceRankRequest("coffee near ludwigsburg",
                List.of(new RankPlace("p3", "Bohnenwerk", "cafe", null, 4.8, 340, null)));

        mockMvc.perform(post("/ai/places/rank")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.rankings[0].placeId").value("p3"))
                .andExpect(jsonPath("$.rankings[0].rank").value(1));
    }

    @Test
    @DisplayName("POST /ai/places/rank → 400 when query is blank")
    void rank_rejectsBlankQuery() throws Exception {
        PlaceRankRequest request = new PlaceRankRequest("  ",
                List.of(new RankPlace("p1", "X", null, null, null, null, null)));

        mockMvc.perform(post("/ai/places/rank")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest());
    }
}
