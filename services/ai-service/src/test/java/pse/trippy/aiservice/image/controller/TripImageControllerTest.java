package pse.trippy.aiservice.image.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import pse.trippy.aiservice.image.dto.TripImageRequest;
import pse.trippy.aiservice.image.dto.TripImageResponse;
import pse.trippy.aiservice.image.service.TripImageService;

import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(TripImageController.class)
@DisplayName("TripImageController")
class TripImageControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private TripImageService tripImageService;

    @Test
    @DisplayName("POST /ai/trip-images → 200 with an image URL")
    void generate_returns200() throws Exception {
        UUID tripId = UUID.randomUUID();
        when(tripImageService.generate(any())).thenReturn(new TripImageResponse(
                tripId, "https://image.pollinations.ai/prompt/paris", "Paris skyline", "flux", "AI", "READY"));

        TripImageRequest request = new TripImageRequest(tripId, "Paris, France", null);

        mockMvc.perform(post("/ai/trip-images")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("READY"))
                .andExpect(jsonPath("$.imageUrl").value("https://image.pollinations.ai/prompt/paris"));
    }

    @Test
    @DisplayName("POST /ai/trip-images with a blank destination → 400")
    void generate_blankDestination_returns400() throws Exception {
        TripImageRequest request = new TripImageRequest(UUID.randomUUID(), "  ", null);

        mockMvc.perform(post("/ai/trip-images")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest());
    }
}
