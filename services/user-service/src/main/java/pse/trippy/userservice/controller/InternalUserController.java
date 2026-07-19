package pse.trippy.userservice.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import pse.trippy.userservice.dto.request.IncrementSubscriptionRequest;
import pse.trippy.userservice.dto.response.SubscriptionInfoResponse;
import pse.trippy.userservice.service.UserProfileService;

import java.util.UUID;

/**
 * Internal REST controller for service-to-service calls.
 *
 * <p>These endpoints are NOT exposed through the public API gateway.
 * No JWT is required — callers are trusted internal services.
 *
 * <p>Used by:
 * <ul>
 *   <li>trip-service — to check and increment {@code tripCount} (TRIP-206)</li>
 *   <li>ai-service   — to check and increment {@code generationCount} (TRIP-502)</li>
 *   <li>chat-service — to verify a user exists (TRIP-301)</li>
 * </ul>
 */
@RestController
@RequestMapping("/internal/v1/users")
@RequiredArgsConstructor
public class InternalUserController {

    private final UserProfileService userProfileService;

    /**
     * Returns the subscription plan and usage counters for a user.
     *
     * @param userId the user's UUID
     * @return 200 with {@link SubscriptionInfoResponse}, or 404 if user not found
     */
    @GetMapping("/{userId}/subscription")
    public ResponseEntity<SubscriptionInfoResponse> getSubscription(@PathVariable UUID userId) {
        return ResponseEntity.ok(userProfileService.getSubscriptionInfo(userId));
    }

    /**
     * Increments the {@code tripCount} or {@code generationCount} for a user.
     * Called after a trip is successfully created or an AI generation completes.
     *
     * @param userId  the user's UUID
     * @param request body with {@code field} = "tripCount" | "generationCount"
     * @return 204 No Content on success
     */
    @PostMapping("/{userId}/subscription/increment")
    public ResponseEntity<Void> incrementSubscription(
            @PathVariable UUID userId,
            @Valid @RequestBody IncrementSubscriptionRequest request) {
        userProfileService.incrementSubscriptionField(userId, request.getField());
        return ResponseEntity.noContent().build();
    }

    /**
     * Returns 200 if a user with this ID exists, 404 otherwise.
     * Used by chat-service to validate participant user IDs.
     *
     * @param userId the user's UUID
     * @return 200 OK or 404 Not Found
     */
    @GetMapping("/{userId}/exists")
    public ResponseEntity<Void> exists(@PathVariable UUID userId) {
        userProfileService.getProfile(userId); // throws UserNotFoundException → 404 if missing
        return ResponseEntity.ok().build();
    }
}
