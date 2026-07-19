package pse.trippy.userservice.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pse.trippy.userservice.dto.request.UpdateProfileRequest;
import pse.trippy.userservice.dto.response.UserProfileResponse;
import pse.trippy.userservice.dto.response.UserPublicProfileResponse;
import pse.trippy.userservice.dto.response.SubscriptionInfoResponse;
import pse.trippy.userservice.exception.UserNotFoundException;
import pse.trippy.userservice.mapper.UserMapper;
import pse.trippy.userservice.model.entity.User;
import pse.trippy.userservice.repository.UserRepository;

import java.util.List;
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
}
