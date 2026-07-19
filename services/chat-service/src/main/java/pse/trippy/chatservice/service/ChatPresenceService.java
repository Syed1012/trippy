package pse.trippy.chatservice.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.Collections;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Tracks which users are currently connected to each chat room, backed by
 * Redis Sets (ticket 3.9 — upgrade from in-memory ConcurrentHashMap).
 *
 * <p>Redis key: {@code presence:trip:{tripId}} — a Set of userId strings.
 * An expiry is set on the whole set as a safety-net TTL; individual members
 * are added/removed on join/leave.  The TTL is reset on every join so an
 * active room never silently expires.
 *
 * <p>Public API is identical to the Sprint 2 implementation so all callers
 * ({@link pse.trippy.chatservice.config.WebSocketAuthChannelInterceptor},
 * {@link pse.trippy.chatservice.config.WebSocketDisconnectListener})
 * require zero changes.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ChatPresenceService {

    private static final String PARTICIPANTS_TOPIC = "/topic/trips.%s.participants";
    private static final String PRESENCE_KEY       = "presence:trip:%s";
    /** Safety-net TTL — a room key expires 24 h after the last join. */
    static final Duration       PRESENCE_TTL       = Duration.ofHours(24);

    private final StringRedisTemplate redisTemplate;
    private final ObjectProvider<SimpMessagingTemplate> messagingTemplateProvider;

    /**
     * Adds a user to a trip's chat room and broadcasts the updated participant list.
     *
     * @return {@code true} if the user was newly added, {@code false} if already present
     */
    public boolean addUser(UUID tripId, UUID userId) {
        String key     = key(tripId);
        String member  = userId.toString();

        Long added = redisTemplate.opsForSet().add(key, member);
        redisTemplate.expire(key, PRESENCE_TTL);  // reset safety-net TTL on activity

        boolean isNew = added != null && added > 0;
        if (isNew) {
            log.debug("User {} joined chat for trip {} (total: {})", userId, tripId,
                    redisTemplate.opsForSet().size(key));
            broadcastParticipants(tripId, getConnectedUsers(tripId));
        }
        return isNew;
    }

    /**
     * Removes a user from a trip's chat room and broadcasts the updated participant list.
     */
    public void removeUser(UUID tripId, UUID userId) {
        String key    = key(tripId);
        String member = userId.toString();

        Long removed = redisTemplate.opsForSet().remove(key, member);
        if (removed != null && removed > 0) {
            log.debug("User {} left chat for trip {}", userId, tripId);
            broadcastParticipants(tripId, getConnectedUsers(tripId));
        }
    }

    /**
     * Returns the set of user UUIDs currently in the trip's chat room.
     */
    public Set<UUID> getConnectedUsers(UUID tripId) {
        Set<String> members = redisTemplate.opsForSet().members(key(tripId));
        if (members == null || members.isEmpty()) {
            return Collections.emptySet();
        }
        return members.stream()
                .map(UUID::fromString)
                .collect(Collectors.toUnmodifiableSet());
    }

    // ------------------------------------------------------------------ helpers

    private void broadcastParticipants(UUID tripId, Set<UUID> users) {
        try {
            messagingTemplateProvider.getObject().convertAndSend(
                    String.format(PARTICIPANTS_TOPIC, tripId),
                    users);
        } catch (Exception e) {
            log.warn("Failed to broadcast participant update for trip {}", tripId, e);
        }
    }

    private static String key(UUID tripId) {
        return String.format(PRESENCE_KEY, tripId);
    }
}

