package pse.trippy.userservice.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import pse.trippy.userservice.dto.request.SaveTripPreferenceRequest;
import pse.trippy.userservice.dto.response.TripPreferenceResponse;
import pse.trippy.userservice.service.TripPreferenceService;

import java.util.UUID;

/**
 * REST controller for trip-scoped travel preferences.
 *
 * <p>Mounted under {@code /users/**} so it is routed to the user-service and
 * protected by the API Gateway, which injects the {@code X-User-Id} header after
 * JWT validation. Requests without this header return 401.
 */
@RestController
@RequestMapping("/users/trip-preferences")
@RequiredArgsConstructor
public class TripPreferenceController {

    private final TripPreferenceService tripPreferenceService;

    /**
     * Creates or updates the authenticated user's preferences for a trip.
     *
     * @param userId  the user ID injected by the gateway (X-User-Id header)
     * @param request the preference fields to persist
     * @return 200 with the saved preferences, or 401 if X-User-Id is absent
     */
    @PostMapping
    public ResponseEntity<TripPreferenceResponse> savePreference(
            @RequestHeader(value = "X-User-Id", required = false) String userId,
            @Valid @RequestBody SaveTripPreferenceRequest request) {

        if (userId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        return ResponseEntity.ok(
                tripPreferenceService.savePreference(UUID.fromString(userId), request));
    }

    /**
     * Returns the authenticated user's preferences for a specific trip.
     *
     * @param userId the user ID injected by the gateway (X-User-Id header)
     * @param tripId the trip to look up
     * @return 200 with the preferences, 404 if none saved, or 401 if X-User-Id is absent
     */
    @GetMapping("/{tripId}")
    public ResponseEntity<TripPreferenceResponse> getPreference(
            @RequestHeader(value = "X-User-Id", required = false) String userId,
            @PathVariable UUID tripId) {

        if (userId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        return ResponseEntity.of(
                tripPreferenceService.getPreference(UUID.fromString(userId), tripId));
    }
}
