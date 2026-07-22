package pse.trippy.aiservice.places.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import pse.trippy.aiservice.places.dto.PlaceInsightsRequest;
import pse.trippy.aiservice.places.dto.PlaceInsightsResponse;
import pse.trippy.aiservice.places.dto.PlaceRankRequest;
import pse.trippy.aiservice.places.dto.PlaceRankResponse;
import pse.trippy.aiservice.places.service.PlaceInsightsService;

/**
 * AI insights for the trip day-map place search: model-written reviews for
 * search results, and a top-3 "which one should I pick" ranking. Stateless.
 */
@RestController
@RequestMapping("/ai/places")
@RequiredArgsConstructor
public class PlacesController {

    private final PlaceInsightsService placeInsightsService;

    /** POST /ai/places/insights — ratings + 2 short reviews per searched place. */
    @PostMapping("/insights")
    public ResponseEntity<PlaceInsightsResponse> insights(
            @Valid @RequestBody PlaceInsightsRequest request) {
        return ResponseEntity.ok(placeInsightsService.insights(request));
    }

    /** POST /ai/places/rank — top-3 ranking of the searched places with reasoning. */
    @PostMapping("/rank")
    public ResponseEntity<PlaceRankResponse> rank(
            @Valid @RequestBody PlaceRankRequest request) {
        return ResponseEntity.ok(placeInsightsService.rank(request));
    }
}
