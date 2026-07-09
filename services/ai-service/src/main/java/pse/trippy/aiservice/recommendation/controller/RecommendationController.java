package pse.trippy.aiservice.recommendation.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import pse.trippy.aiservice.recommendation.dto.RecommendationRequest;
import pse.trippy.aiservice.recommendation.dto.RecommendationResponse;
import pse.trippy.aiservice.recommendation.service.ItineraryRecommendationService;

/**
 * Local-Ollama itinerary recommendations for the trip AI sidebar.
 *
 * <p>Isolated from {@code AiController}; both live under {@code /ai/**} (routed by
 * the API Gateway) but on distinct sub-paths. Protected via JWT injected by the gateway.
 */
@RestController
@RequestMapping("/ai/recommendations")
@RequiredArgsConstructor
public class RecommendationController {

    private final ItineraryRecommendationService recommendationService;

    /**
     * POST /ai/recommendations
     * Generates three suggestion options per requested day (whole trip, or a
     * single day when {@code dayNumber} is supplied) and stores them for the trip.
     */
    @PostMapping
    public ResponseEntity<RecommendationResponse> generate(
            @Valid @RequestBody RecommendationRequest request) {
        return ResponseEntity.ok(recommendationService.generate(request));
    }
}
