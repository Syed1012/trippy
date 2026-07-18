package pse.trippy.chatservice.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import pse.trippy.chatservice.dto.event.TypingEvent;

import java.time.Duration;
import java.util.UUID;

/**
 * Manages debounced "is typing" events via Redis.
 *
 * <p>Design: each user-in-room has a Redis key
 * {@code typing:trip:{tripId}:user:{userId}} with a short TTL (ticket 3.8).
 * When a {@code typing=true} event arrives the key is set (or its TTL
 * refreshed). When a {@code typing=false} event is received — the stop event
 * is broadcast to STOMP subscribers.
 *
 * <p>This gives natural debouncing: rapid "still typing" frames from the client
 * simply reset the TTL without triggering a new broadcast.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class TypingIndicatorService {

    private static final String TYPING_TOPIC   = "/topic/trips.%s.typing";
    private static final String REDIS_KEY      = "typing:trip:%s:user:%s";
    static final Duration       TYPING_TTL     = Duration.ofSeconds(5);

    private final StringRedisTemplate redisTemplate;
    private final ObjectProvider<SimpMessagingTemplate> messagingTemplateProvider;

    /**
     * Records that {@code userId} is typing in {@code tripId} and broadcasts
     * a {@code typing=true} event only on state transitions (not-typing → typing).
     */
    public void userStartedTyping(UUID tripId, UUID userId, String displayName) {
        String key = key(tripId, userId);
        Boolean created = redisTemplate.opsForValue().setIfAbsent(key, "1", TYPING_TTL);
        if (Boolean.TRUE.equals(created)) {
            broadcast(new TypingEvent(tripId, userId, displayName, true));
            return;
        }
        redisTemplate.expire(key, TYPING_TTL);
    }

    /**
     * Records that {@code userId} stopped typing and broadcasts a
     * {@code typing=false} event.  Idempotent if the key has already expired.
     */
    public void userStoppedTyping(UUID tripId, UUID userId, String displayName) {
        String key = key(tripId, userId);
        Boolean existed = redisTemplate.hasKey(key);
        redisTemplate.delete(key);

        if (Boolean.TRUE.equals(existed)) {
            broadcast(new TypingEvent(tripId, userId, displayName, false));
        }
    }

    /** Returns {@code true} if the user is currently marked as typing. */
    public boolean isTyping(UUID tripId, UUID userId) {
        return Boolean.TRUE.equals(redisTemplate.hasKey(key(tripId, userId)));
    }

    // ------------------------------------------------------------------ helpers

    private void broadcast(TypingEvent event) {
        try {
            messagingTemplateProvider.getObject()
                    .convertAndSend(String.format(TYPING_TOPIC, event.tripId()), event);
        } catch (Exception ex) {
            log.warn("Failed to broadcast typing event for trip {} user {}",
                    event.tripId(), event.userId(), ex);
        }
    }

    private static String key(UUID tripId, UUID userId) {
        return String.format(REDIS_KEY, tripId, userId);
    }
}
