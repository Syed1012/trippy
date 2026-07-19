package pse.trippy.chatservice.controller;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.stereotype.Controller;
import pse.trippy.chatservice.config.WebSocketAuthChannelInterceptor;
import pse.trippy.chatservice.dto.request.SendMessageRequest;
import pse.trippy.chatservice.dto.response.ChatMessageResponse;
import pse.trippy.chatservice.model.enums.MessageType;
import pse.trippy.chatservice.service.ChatMessageService;

import java.security.Principal;
import java.util.UUID;

/**
 * STOMP WebSocket controller for real-time chat messaging.
 */
@Controller
@RequiredArgsConstructor
@Slf4j
public class ChatWebSocketController {

    private final ChatMessageService chatMessageService;
    private final WebSocketAuthChannelInterceptor authChannelInterceptor;

    /**
     * Handles messages sent to /app/trips/{tripId}/send.
    * Persists the message and broadcasts to /topic/trips.{tripId}.messages.
     * User identity is derived from the server-validated STOMP session principal
     * (set by {@link WebSocketAuthChannelInterceptor} on CONNECT).
     */
    @MessageMapping("/trips/{tripId}/send")
    public ChatMessageResponse sendMessage(
            @DestinationVariable UUID tripId,
            StompHeaderAccessor headerAccessor,
            Principal principal,
            SendMessageRequest request) {

        UUID senderId = resolveUserId(principal, headerAccessor);
        String senderName = resolveDisplayName(headerAccessor);

        log.debug("STOMP message received for trip {} from user {}", tripId, senderId);

        MessageType messageType;
        try {
            messageType = MessageType.valueOf(request.getType());
        } catch (IllegalArgumentException e) {
            messageType = MessageType.TEXT;
        }

        return chatMessageService.sendMessage(
                tripId, senderId, senderName, request.getContent(), messageType);
    }

    private UUID resolveUserId(Principal principal, StompHeaderAccessor accessor) {
        // Prefer server-derived principal (set during JWT-authenticated CONNECT)
        if (principal != null) {
            try {
                return UUID.fromString(principal.getName());
            } catch (IllegalArgumentException ignored) {
                // fall through
            }
        }
        return authChannelInterceptor.resolveUserId(accessor);
    }

    private String resolveDisplayName(StompHeaderAccessor accessor) {
        String name = authChannelInterceptor.resolveDisplayName(accessor);
        return (name != null && !name.isBlank()) ? name : "Anonymous";
    }
}

