package pse.trippy.chatservice.config;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;
import pse.trippy.chatservice.service.ChatPresenceService;

import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Listens for WebSocket session disconnect events to remove users from chat presence
 * and broadcast system leave messages.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class WebSocketDisconnectListener {

    private final ChatPresenceService chatPresenceService;

    /**
     * Stores session-to-user/trip mapping set by the channel interceptor on subscribe.
     * Key: sessionId, Value: map of tripId -> userId
     */
    private static final Map<String, Map<UUID, UUID>> sessionSubscriptions = new ConcurrentHashMap<>();

    /**
     * Stores session-to-display-name mapping.
     */
    private static final Map<String, String> sessionDisplayNames = new ConcurrentHashMap<>();

    /**
     * Called by the channel interceptor when a user subscribes to a trip chat.
     */
    public void trackSubscription(String sessionId, UUID tripId, UUID userId, String displayName) {
        sessionSubscriptions.computeIfAbsent(sessionId, k -> new ConcurrentHashMap<>())
                .put(tripId, userId);
        if (displayName != null && !displayName.isBlank()) {
            sessionDisplayNames.put(sessionId, displayName);
        }
    }

    @EventListener
    public void handleSessionDisconnect(SessionDisconnectEvent event) {
        StompHeaderAccessor accessor = StompHeaderAccessor.wrap(event.getMessage());
        String sessionId = accessor.getSessionId();
        if (sessionId == null) {
            return;
        }

        Map<UUID, UUID> subscriptions = sessionSubscriptions.remove(sessionId);
        sessionDisplayNames.remove(sessionId);

        if (subscriptions == null || subscriptions.isEmpty()) {
            return;
        }

        subscriptions.forEach((tripId, userId) -> {
            chatPresenceService.scheduleRemoval(tripId, userId);
            log.debug("User {} disconnected from trip {} chat", userId, tripId);
        });
    }
}
