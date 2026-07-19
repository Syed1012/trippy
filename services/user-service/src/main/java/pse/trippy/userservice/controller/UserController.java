package pse.trippy.userservice.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import pse.trippy.userservice.dto.request.ChangePasswordRequest;
import pse.trippy.userservice.dto.request.DeleteAccountRequest;
import pse.trippy.userservice.dto.request.ResendVerificationRequest;
import pse.trippy.userservice.dto.request.UpdateProfileRequest;
import pse.trippy.userservice.dto.request.VerifyEmailRequest;
import pse.trippy.userservice.dto.response.UserProfileResponse;
import pse.trippy.userservice.dto.response.UserPublicProfileResponse;
import pse.trippy.userservice.service.EmailVerificationService;
import pse.trippy.userservice.service.UserProfileService;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * REST controller for user profile management.
 *
 * <p>User identity is provided by the API Gateway via the {@code X-User-Id} header,
 * which is injected after JWT validation. Requests without this header return 401.
 */
@RestController
@RequestMapping("/users")
@RequiredArgsConstructor
public class UserController {

    private final UserProfileService userProfileService;
    private final EmailVerificationService emailVerificationService;

    /**
     * Returns the authenticated user's full profile.
     *
     * @param userId the user ID injected by the gateway (X-User-Id header)
     * @return 200 with profile, or 401 if X-User-Id is absent
     */
    @GetMapping("/me")
    public ResponseEntity<UserProfileResponse> getProfile(
            @RequestHeader(value = "X-User-Id", required = false) String userId) {

        if (userId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        return ResponseEntity.ok(userProfileService.getProfile(UUID.fromString(userId)));
    }

    /**
     * Partially updates the authenticated user's profile.
     * Only non-null fields are applied.
     *
     * @param userId  the user ID injected by the gateway (X-User-Id header)
     * @param request the fields to update
     * @return 200 with updated profile, or 401 if X-User-Id is absent
     */
    @PatchMapping("/me")
    public ResponseEntity<UserProfileResponse> updateProfile(
            @RequestHeader(value = "X-User-Id", required = false) String userId,
            @Valid @RequestBody UpdateProfileRequest request) {

        if (userId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        return ResponseEntity.ok(userProfileService.updateProfile(UUID.fromString(userId), request));
    }

    /**
     * Changes the authenticated user's password.
     * Verifies the current password first; revokes all refresh tokens on success.
     *
     * @param userId  the user ID injected by the gateway (X-User-Id header)
     * @param request currentPassword + newPassword
     * @return 204 No Content, 400 if current password wrong, 401 if unauthenticated
     */
    @PutMapping("/me/password")
    public ResponseEntity<Void> changePassword(
            @RequestHeader(value = "X-User-Id", required = false) String userId,
            @Valid @RequestBody ChangePasswordRequest request) {

        if (userId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        userProfileService.changePassword(UUID.fromString(userId), request);
        return ResponseEntity.noContent().build();
    }

    /**
     * Permanently deletes the authenticated user's account.
     * Requires password confirmation in the request body.
     *
     * @param userId  the user ID injected by the gateway (X-User-Id header)
     * @param request password confirmation
     * @return 204 No Content, 400 if password wrong, 401 if unauthenticated
     */
    @DeleteMapping("/me")
    public ResponseEntity<Void> deleteAccount(
            @RequestHeader(value = "X-User-Id", required = false) String userId,
            @Valid @RequestBody DeleteAccountRequest request) {

        if (userId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        userProfileService.deleteAccount(UUID.fromString(userId), request.getPassword());
        return ResponseEntity.noContent().build();
    }

    /**
     * Verifies a user's email address using the provided token.
     *
     * @param request the verification request containing the token
     * @return 200 OK with a success message
     */
    @PostMapping("/verify-email")
    public ResponseEntity<Map<String, String>> verifyEmail(
            @Valid @RequestBody VerifyEmailRequest request) {
        emailVerificationService.verifyEmail(request.getToken());
        return ResponseEntity.ok(Map.of("message", "Email verified successfully."));
    }

    /**
     * Resends the verification email to the specified address.
     * Rate-limited to one request per minute per user.
     *
     * @param request the resend request containing the email
     * @return 200 OK with a success message
     */
    @PostMapping("/resend-verification")
    public ResponseEntity<Map<String, String>> resendVerification(
            @Valid @RequestBody ResendVerificationRequest request) {
        emailVerificationService.resendVerification(request.getEmail());
        return ResponseEntity.ok(Map.of("message", "Verification email sent."));
    }

    /**
     * Returns public profiles for a batch of user IDs.
     * Used internally to resolve participant names for trip details.
     *
     * @param userIds list of user UUIDs to look up
     * @return 200 with list of public profile responses (only found users)
     */
    @PostMapping("/batch")
    public ResponseEntity<List<UserPublicProfileResponse>> getBatchProfiles(
            @RequestBody List<UUID> userIds) {
        return ResponseEntity.ok(userProfileService.getPublicProfiles(userIds));
    }

    /**
     * Returns the public profile for a single user by ID.
     *
     * @param userId the user's UUID
     * @return 200 with public profile, or 404 if not found
     */
    @GetMapping("/{userId}")
    public ResponseEntity<UserPublicProfileResponse> getPublicProfile(
            @PathVariable UUID userId) {
        return ResponseEntity.ok(userProfileService.getPublicProfile(userId));
    }

    @GetMapping("/search")
    public ResponseEntity<List<UserPublicProfileResponse>> searchUsers(
            @RequestParam String q,
            @RequestParam(defaultValue = "10") int limit) {
        if (q == null || q.trim().length() < 2) {
            return ResponseEntity.ok(List.of());
        }
        List<UserPublicProfileResponse> results = userProfileService.searchUsers(q.trim(), Math.min(limit, 20));
        return ResponseEntity.ok(results);
    }
}
