package pse.trippy.chatservice.config;

import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.MessageDeliveryException;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageBuilder;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.stereotype.Component;
import pse.trippy.chatservice.client.TripServiceClient;
import pse.trippy.chatservice.model.enums.MessageType;
import pse.trippy.chatservice.service.ChatMessageService;
import pse.trippy.chatservice.service.ChatPresenceService;
import pse.trippy.chatservice.service.ModerationService;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Channel interceptor that:
 * <ol>
 *   <li>On STOMP CONNECT — validates the JWT Bearer token and sets the session
 *       principal (WS Auth Hardening). No client-supplied X-User-Id is trusted
 *       on connect.</li>
 *   <li>On STOMP SUBSCRIBE — verifies trip participation using the server-derived
 *       principal and broadcasts system join messages.</li>
 * </ol>
 *
 * <p>User identity for all subsequent STOMP frames is derived from
 * {@link StompHeaderAccessor#getUser()}, which is set here on CONNECT.
 * Session attributes {@code userId} and {@code displayName} are stored for
 * reuse by the disconnect listener and typing indicator controller.
 */
@Component
@Slf4j
public class WebSocketAuthChannelInterceptor implements ChannelInterceptor {

    static final String SESSION_ATTR_USER_ID      = "userId";
    static final String SESSION_ATTR_DISPLAY_NAME = "displayName";

    private static final String BEARER_PREFIX = "Bearer ";
    private static final Pattern TOPIC_PATTERN =
            Pattern.compile("^/topic/trips\\.([0-9a-fA-F\\-]+)\\.(messages|participants|typing)$");
        private static final Pattern APP_DESTINATION_PATTERN =
            Pattern.compile("^/app/trips/([0-9a-fA-F\\-]+)/(send|typing)$");

    private final JwtDecoder jwtDecoder;
    private final TripServiceClient tripServiceClient;
    private final ChatPresenceService chatPresenceService;
    private final ChatMessageService chatMessageService;
    private final WebSocketDisconnectListener disconnectListener;
    private final ModerationService moderationService;

    public WebSocketAuthChannelInterceptor(
            JwtDecoder jwtDecoder,
            TripServiceClient tripServiceClient,
            ChatPresenceService chatPresenceService,
            @org.springframework.context.annotation.Lazy ChatMessageService chatMessageService,
            @org.springframework.context.annotation.Lazy WebSocketDisconnectListener disconnectListener,
            ModerationService moderationService) {
        this.jwtDecoder = jwtDecoder;
        this.tripServiceClient = tripServiceClient;
        this.chatPresenceService = chatPresenceService;
        this.chatMessageService = chatMessageService;
        this.disconnectListener = disconnectListener;
        this.moderationService = moderationService;
    }

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor accessor =
                MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);
        if (accessor == null) {
            return message;
        }

        StompCommand command = accessor.getCommand();

        if (StompCommand.CONNECT.equals(command)) {
            return handleConnect(message, accessor);
        }

        if (StompCommand.SUBSCRIBE.equals(command)) {
            handleSubscribe(accessor);
        }

        if (StompCommand.SEND.equals(command)) {
            handleSend(accessor);
        }

        return message;
    }

    // ------------------------------------------------------------------ CONNECT

    /**
     * Validates the JWT on STOMP CONNECT and sets the session principal.
     * Rejects the connection if the token is missing, invalid, or expired.
     */
    private Message<?> handleConnect(Message<?> message, StompHeaderAccessor accessor) {
        String authHeader = accessor.getFirstNativeHeader("Authorization");
        if (authHeader == null || !authHeader.startsWith(BEARER_PREFIX)) {
            throw new MessageDeliveryException("Missing or invalid Authorization header on CONNECT");
        }

        String token = authHeader.substring(BEARER_PREFIX.length());
        Jwt jwt;
        try {
            jwt = jwtDecoder.decode(token);
        } catch (JwtException ex) {
            log.debug("STOMP CONNECT rejected — JWT validation failed: {}", ex.getMessage());
            throw new MessageDeliveryException("Invalid or expired JWT");
        }

        String userIdStr   = jwt.getSubject();
        String displayName = jwt.getClaimAsString("displayName");
        String role        = jwt.getClaimAsString("role");

        if (userIdStr == null) {
            throw new MessageDeliveryException("JWT missing 'sub' claim");
        }

        UUID userId;
        try {
            userId = UUID.fromString(userIdStr);
        } catch (IllegalArgumentException ex) {
            throw new MessageDeliveryException("JWT 'sub' is not a valid UUID");
        }

        List<SimpleGrantedAuthority> authorities = role != null
                ? List.of(new SimpleGrantedAuthority("ROLE_" + role.toUpperCase()))
                : List.of();

        UsernamePasswordAuthenticationToken principal =
                new UsernamePasswordAuthenticationToken(userIdStr, null, authorities);

        accessor.setUser(principal);

        // Store in session attributes for reuse by the disconnect listener and
        // typing indicator controller without re-parsing the JWT each time.
        Map<String, Object> attrs = accessor.getSessionAttributes();
        if (attrs != null) {
            attrs.put(SESSION_ATTR_USER_ID, userId);
            attrs.put(SESSION_ATTR_DISPLAY_NAME, displayName != null ? displayName : "");
        }

        log.info("STOMP CONNECT authenticated — userId={}", userId);

        // Rebuild the message so the mutated accessor (with the new principal) is propagated.
        return MessageBuilder.createMessage(message.getPayload(), accessor.getMessageHeaders());
    }

    // -------------------------------------------------------------------- SEND

    /**
     * Enforces ban and mute before allowing a STOMP SEND (outbound message).
     * Banned and muted users receive a rejection.
     */
    private void handleSend(StompHeaderAccessor accessor) {
        String destination = accessor.getDestination();
        if (destination == null) {
            return;
        }

        Matcher matcher = APP_DESTINATION_PATTERN.matcher(destination);
        if (!matcher.matches()) {
            return;
        }

        UUID userId = resolveUserId(accessor);
        if (userId == null) {
            throw new MessageDeliveryException("Unauthenticated chat message");
        }

        UUID tripId;
        try {
            tripId = UUID.fromString(matcher.group(1));
        } catch (IllegalArgumentException e) {
            throw new MessageDeliveryException("Invalid trip id in destination");
        }

        if (!tripServiceClient.isParticipant(tripId, userId)) {
            log.warn("Rejected SEND from user {} to trip {} — not a participant", userId, tripId);
            throw new MessageDeliveryException("User is not a participant of trip " + tripId);
        }

        if (moderationService.isBanned(userId)) {
            log.warn("Rejected SEND from banned user {}", userId);
            throw new MessageDeliveryException("User is banned from chat");
        }

        if (moderationService.isMuted(userId)) {
            log.warn("Rejected SEND from muted user {}", userId);
            throw new MessageDeliveryException("User is muted — cannot send messages");
        }
    }

    // ---------------------------------------------------------------- SUBSCRIBE

    private void handleSubscribe(StompHeaderAccessor accessor) {
        String destination = accessor.getDestination();
        if (destination == null) {
            return;
        }

        Matcher matcher = TOPIC_PATTERN.matcher(destination);
        if (!matcher.matches()) {
            return;
        }

        UUID tripId;
        try {
            tripId = UUID.fromString(matcher.group(1));
        } catch (IllegalArgumentException e) {
            throw new MessageDeliveryException("Invalid trip id in destination");
        }
        String topicSuffix = matcher.group(2);

        // Prefer server-derived identity; fall back to X-User-Id only for
        // backwards-compat with the API gateway HTTP path (non-WS requests).
        UUID userId = resolveUserId(accessor);
        String displayName = resolveDisplayName(accessor);

        if (userId == null) {
            throw new MessageDeliveryException("Missing X-User-Id header");
        }

        if (!tripServiceClient.isParticipant(tripId, userId)) {
            log.warn("User {} denied subscription to trip {} ({}) — not a participant",
                    userId, tripId, topicSuffix);
            throw new MessageDeliveryException("User is not a participant of trip " + tripId);
        }

        log.info("User {} verified as participant for trip {} ({})", userId, tripId, topicSuffix);

        // Presence tracking + join-message side effects only apply to the main
        // messages topic. /participants and /typing are read-only views.
        if (!"messages".equals(topicSuffix)) {
            return;
        }

        boolean newJoin = chatPresenceService.addUser(tripId, userId);
        if (newJoin) {
            String name = (displayName != null && !displayName.isBlank()) ? displayName : "A user";

            String sessionId = accessor.getSessionId();
            if (sessionId != null) {
                disconnectListener.trackSubscription(sessionId, tripId, userId, displayName);
            }

            try {
                chatMessageService.sendMessage(
                        tripId, userId, "System",
                        name + " joined the chat",
                        MessageType.SYSTEM);
            } catch (Exception e) {
                log.warn("Failed to send join message for user {} in trip {}", userId, tripId, e);
            }
        }
    }

    // ------------------------------------------------------------------ helpers

    /**
     * Returns the authenticated userId from the session principal (STOMP path)
     * or, as a fallback, from the {@code X-User-Id} STOMP native header
     * (HTTP/REST path where the gateway injects the header).
     */
    public UUID resolveUserId(StompHeaderAccessor accessor) {
        // 1) Server-derived from JWT (preferred)
        if (accessor.getUser() != null) {
            try {
                return UUID.fromString(accessor.getUser().getName());
            } catch (IllegalArgumentException ignored) {
                // fall through
            }
        }
        // 2) Session attribute set on CONNECT
        Map<String, Object> attrs = accessor.getSessionAttributes();
        if (attrs != null && attrs.get(SESSION_ATTR_USER_ID) instanceof UUID uid) {
            return uid;
        }
        // 3) Native header — only trust after gateway injection on HTTP routes
        String header = accessor.getFirstNativeHeader("X-User-Id");
        if (header != null && !header.isBlank()) {
            try {
                return UUID.fromString(header);
            } catch (IllegalArgumentException ignored) {
                throw new MessageDeliveryException("Invalid X-User-Id header");
            }
        }
        return null;
    }

    public String resolveDisplayName(StompHeaderAccessor accessor) {
        Map<String, Object> attrs = accessor.getSessionAttributes();
        if (attrs != null && attrs.get(SESSION_ATTR_DISPLAY_NAME) instanceof String s && !s.isBlank()) {
            return s;
        }
        return accessor.getFirstNativeHeader("X-User-DisplayName");
    }
}
