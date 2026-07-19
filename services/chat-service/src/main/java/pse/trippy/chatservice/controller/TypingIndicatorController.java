package pse.trippy.chatservice.controller;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.stereotype.Controller;
import pse.trippy.chatservice.config.WebSocketAuthChannelInterceptor;
import pse.trippy.chatservice.dto.request.TypingRequest;
import pse.trippy.chatservice.service.TypingIndicatorService;

import java.security.Principal;
import java.util.UUID;

/**
 * STOMP controller for ticket 3.8 — Typing Indicator.
 *
 * <p>Clients send a STOMP MESSAGE to {@code /app/trips/{tripId}/typing} with a
 * {@link TypingRequest} payload.  The service manages debounced Redis state and
 * broadcasts {@code TypingEvent} frames to
 * {@code /topic/trips.{tripId}.typing}.
 *
 * <p>User identity is always derived server-side from the STOMP session
 * principal (set by {@link WebSocketAuthChannelInterceptor} on CONNECT).
 */
@Controller
@RequiredArgsConstructor
@Slf4j
public class TypingIndicatorController {

    private final TypingIndicatorService typingIndicatorService;
    private final WebSocketAuthChannelInterceptor authChannelInterceptor;

    @MessageMapping("/trips/{tripId}/typing")
    public void handleTyping(
            @DestinationVariable UUID tripId,
            StompHeaderAccessor headerAccessor,
            Principal principal,
            TypingRequest request) {

        UUID userId = resolveUserId(principal, headerAccessor);
        if (userId == null) {
            log.warn("Typing event received without authenticated user for trip {}", tripId);
            return;
        }

        String displayName = authChannelInterceptor.resolveDisplayName(headerAccessor);

        log.debug("Typing event for trip {} from user {}: typing={}", tripId, userId, request.typing());

        if (request.typing()) {
            typingIndicatorService.userStartedTyping(tripId, userId, displayName);
        } else {
            typingIndicatorService.userStoppedTyping(tripId, userId, displayName);
        }
    }

    private UUID resolveUserId(Principal principal, StompHeaderAccessor accessor) {
        if (principal != null) {
            try {
                return UUID.fromString(principal.getName());
            } catch (IllegalArgumentException ignored) {
                // fall through
            }
        }
        return authChannelInterceptor.resolveUserId(accessor);
    }
}
