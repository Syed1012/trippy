package pse.trippy.aiservice.image.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import pse.trippy.aiservice.image.dto.TripImageRequest;
import pse.trippy.aiservice.image.dto.TripImageResponse;
import pse.trippy.aiservice.image.service.TripImageService;

/**
 * Generates trip cover images from the destination. Isolated under {@code /ai/**}
 * (routed by the API Gateway); protected via JWT injected by the gateway.
 */
@RestController
@RequestMapping("/ai/trip-images")
@RequiredArgsConstructor
public class TripImageController {

    private final TripImageService tripImageService;

    /**
     * POST /ai/trip-images
     * Returns a deterministic cover image URL for the trip destination.
     */
    @PostMapping
    public ResponseEntity<TripImageResponse> generate(@Valid @RequestBody TripImageRequest request) {
        return ResponseEntity.ok(tripImageService.generate(request));
    }
}
