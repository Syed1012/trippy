package pse.trippy.userservice.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.AmqpException;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pse.trippy.userservice.config.RabbitMqConfig;
import pse.trippy.userservice.dto.request.ChangePasswordRequest;
import pse.trippy.userservice.dto.request.UpdateProfileRequest;
import pse.trippy.userservice.dto.response.UserProfileResponse;
import pse.trippy.userservice.dto.response.UserPublicProfileResponse;
import pse.trippy.userservice.dto.response.SubscriptionInfoResponse;
import pse.trippy.userservice.exception.InvalidPasswordException;
import pse.trippy.userservice.exception.UserNotFoundException;
import pse.trippy.userservice.mapper.UserMapper;
import pse.trippy.userservice.model.entity.User;
import pse.trippy.userservice.repository.EmailVerificationTokenRepository;
import pse.trippy.userservice.repository.RefreshTokenRepository;
import pse.trippy.userservice.repository.UserRepository;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Service for user profile read and update operations.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class UserProfileService {

    private final UserRepository userRepository;
    private final UserMapper userMapper;
    private final PasswordEncoder passwordEncoder;
    private final RefreshTokenRepository refreshTokenRepository;
    private final EmailVerificationTokenRepository emailVerificationTokenRepository;
    private final RabbitTemplate rabbitTemplate;

    /**
     * Returns the full profile for the given user.
     *
     * @param userId the user's UUID (from X-User-Id header)
     * @return populated {@link UserProfileResponse}
     * @throws UserNotFoundException if no user exists with the given ID
     */
    public UserProfileResponse getProfile(UUID userId) {
        User user = findUser(userId);
        return userMapper.toResponse(user);
    }

    /**
     * Applies a partial update to the user's profile.
     * Only non-null fields in {@code request} are written.
     *
     * @param userId  the user's UUID (from X-User-Id header)
     * @param request the fields to update
     * @return updated {@link UserProfileResponse}
     * @throws UserNotFoundException if no user exists with the given ID
     */
    @Transactional
    public UserProfileResponse updateProfile(UUID userId, UpdateProfileRequest request) {
        User user = findUser(userId);

        if (request.getDisplayName() != null) {
            user.setDisplayName(request.getDisplayName());
        }
        if (request.getBio() != null) {
            user.setBio(request.getBio());
        }
        if (request.getPhoneNumber() != null) {
            user.setPhoneNumber(request.getPhoneNumber());
        }
        if (request.getCountry() != null) {
            user.setCountry(request.getCountry());
        }
        if (request.getAvatarUrl() != null) {
            user.setAvatarUrl(request.getAvatarUrl());
        }

        User saved = userRepository.save(user);
        log.info("Profile updated for user {}", userId);
        return userMapper.toResponse(saved);
    }

    private User findUser(UUID userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new UserNotFoundException(userId));
    }

    /**
     * Returns a lightweight public profile for a single user.
     */
    public UserPublicProfileResponse getPublicProfile(UUID userId) {
        User user = findUser(userId);
        return UserPublicProfileResponse.builder()
                .id(user.getId())
                .displayName(user.getDisplayName())
                .avatarUrl(user.getAvatarUrl())
                .country(user.getCountry())
                .build();
    }

    /**
     * Returns public profiles for a batch of user IDs.
     * Skips any IDs that don't exist.
     */
    public List<UserPublicProfileResponse> getPublicProfiles(List<UUID> userIds) {
        return userRepository.findAllById(userIds).stream()
                .map(user -> UserPublicProfileResponse.builder()
                        .id(user.getId())
                        .displayName(user.getDisplayName())
                        .avatarUrl(user.getAvatarUrl())
                        .country(user.getCountry())
                        .build())
                .toList();
    }

    public List<UserPublicProfileResponse> searchUsers(String query, int limit) {
        Page<User> results = userRepository.searchByNameOrEmail(
                query, PageRequest.of(0, limit));
        return results.getContent().stream()
                .map(user -> UserPublicProfileResponse.builder()
                        .id(user.getId())
                        .displayName(user.getDisplayName())
                        .avatarUrl(user.getAvatarUrl())
                        .country(user.getCountry())
                        .email(user.getEmail())
                        .build())
                .toList();
    }

    /**
     * Returns subscription plan and usage counters for a user.
     *
     * @param userId the user's UUID
     * @return subscription info with plan and usage counters
     * @throws UserNotFoundException if user not found
     */
    public SubscriptionInfoResponse getSubscriptionInfo(UUID userId) {
        User user = findUser(userId);
        return SubscriptionInfoResponse.builder()
                .plan(user.getPlan())
                .tripCount(user.getTripCount())
                .generationCount(user.getGenerationCount())
                .build();
    }

    /**
     * Increments a subscription counter field for a user.
     *
     * @param userId the user's UUID
     * @param field  "tripCount" or "generationCount"
     * @throws UserNotFoundException if user not found
     */
    @Transactional
    public void incrementSubscriptionField(UUID userId, String field) {
        User user = findUser(userId);
        
        switch (field) {
            case "tripCount":
                user.setTripCount(user.getTripCount() + 1);
                break;
            case "generationCount":
                user.setGenerationCount(user.getGenerationCount() + 1);
                break;
            default:
                throw new IllegalArgumentException("Unknown field: " + field);
        }
        
        userRepository.save(user);
        log.info("Subscription field '{}' incremented for user {}", field, userId);
    }

    /**
     * Changes the user's password after verifying the current one.
     * All refresh tokens are revoked so other sessions must log in again.
     *
     * @param userId  the user's UUID (from X-User-Id header)
     * @param request contains currentPassword and newPassword
     * @throws UserNotFoundException    if user not found
     * @throws InvalidPasswordException if the current password is wrong
     */
    @Transactional
    public void changePassword(UUID userId, ChangePasswordRequest request) {
        User user = findUser(userId);

        if (!passwordEncoder.matches(request.getCurrentPassword(), user.getPasswordHash())) {
            throw new InvalidPasswordException("Current password is incorrect");
        }

        user.setPasswordHash(passwordEncoder.encode(request.getNewPassword()));
        userRepository.save(user);

        // Revoke all sessions — force re-login everywhere with the new password
        refreshTokenRepository.deleteAllByUserId(userId);

        log.info("Password changed for user {} — all refresh tokens revoked", userId);
    }

    /**
     * Permanently deletes the user's account after verifying their password.
     * Cleans up refresh and verification tokens, then publishes a
     * {@code user.deleted} event so other services can react.
     *
     * @param userId   the user's UUID (from X-User-Id header)
     * @param password the user's current password, for confirmation
     * @throws UserNotFoundException    if user not found
     * @throws InvalidPasswordException if the password is wrong
     */
    @Transactional
    public void deleteAccount(UUID userId, String password) {
        User user = findUser(userId);

        if (!passwordEncoder.matches(password, user.getPasswordHash())) {
            throw new InvalidPasswordException("Password is incorrect");
        }

        refreshTokenRepository.deleteAllByUserId(userId);
        emailVerificationTokenRepository.deleteAllByUserId(userId);
        userRepository.delete(user);

        log.info("Account deleted for user {}", userId);
        publishUserDeletedEvent(userId, user.getEmail());
    }

    /** Publishes a {@code user.deleted} event; failures are logged, not rethrown. */
    private void publishUserDeletedEvent(UUID userId, String email) {
        Map<String, Object> event = Map.of(
                "eventType", "user.deleted",
                "userId", userId.toString(),
                "email", email,
                "timestamp", Instant.now().toString()
        );
        try {
            rabbitTemplate.convertAndSend(RabbitMqConfig.USER_EVENTS_EXCHANGE, "user.deleted", event);
            log.info("Published user.deleted event for userId={}", userId);
        } catch (AmqpException ex) {
            log.error("Failed to publish user.deleted event for userId={}", userId, ex);
        }
    }
}
