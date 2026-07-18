package pse.trippy.chatservice.config;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.MessageDeliveryException;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.MessageBuilder;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import pse.trippy.chatservice.client.TripServiceClient;
import pse.trippy.chatservice.service.ChatMessageService;
import pse.trippy.chatservice.service.ChatPresenceService;
import pse.trippy.chatservice.service.ModerationService;

import java.security.Principal;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@DisplayName("WebSocketAuthChannelInterceptor")
class WebSocketAuthChannelInterceptorTest {

    @Mock
    private JwtDecoder jwtDecoder;

    @Mock
    private TripServiceClient tripServiceClient;

    @Mock
    private ChatPresenceService chatPresenceService;

    @Mock
    private ChatMessageService chatMessageService;

    @Mock
    private WebSocketDisconnectListener disconnectListener;

    @Mock
    private ModerationService moderationService;

    @Mock
    private MessageChannel channel;

    private WebSocketAuthChannelInterceptor interceptor;

    @BeforeEach
    void setUp() {
        interceptor = new WebSocketAuthChannelInterceptor(
                jwtDecoder, tripServiceClient, chatPresenceService,
                chatMessageService, disconnectListener, moderationService);
    }

    // --------------------------------------------------------------- SUBSCRIBE

    @Test
    @DisplayName("allows subscription when user is a verified participant")
    void allowsSubscriptionForVerifiedParticipant() {
        UUID tripId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();

        when(tripServiceClient.isParticipant(tripId, userId)).thenReturn(true);
        when(chatPresenceService.addUser(tripId, userId)).thenReturn(true);

        Message<?> result = interceptor.preSend(createSubscribeMessage(tripId, userId, "Alice"), channel);

        assertThat(result).isNotNull();
        verify(tripServiceClient).isParticipant(tripId, userId);
    }

    @Test
    @DisplayName("rejects subscription when user is not a participant")
    void rejectsSubscriptionForNonParticipant() {
        UUID tripId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();

        when(tripServiceClient.isParticipant(tripId, userId)).thenReturn(false);

        assertThatThrownBy(() -> interceptor.preSend(createSubscribeMessage(tripId, userId, "Intruder"), channel))
                .isInstanceOf(MessageDeliveryException.class)
                .hasMessageContaining("not a participant");
    }

    @Test
    @DisplayName("rejects subscription when X-User-Id header is missing")
    void rejectsSubscriptionWhenUserIdMissing() {
        UUID tripId = UUID.randomUUID();

        StompHeaderAccessor accessor = StompHeaderAccessor.create(StompCommand.SUBSCRIBE);
        accessor.setDestination("/topic/trips." + tripId + ".messages");
        Message<?> message = MessageBuilder.createMessage(new byte[0], accessor.getMessageHeaders());

        assertThatThrownBy(() -> interceptor.preSend(message, channel))
                .isInstanceOf(MessageDeliveryException.class)
                .hasMessageContaining("Missing X-User-Id");
    }

    @Test
    @DisplayName("broadcasts system join message for first-time subscriber")
    void broadcastsJoinMessageForNewSubscriber() {
        UUID tripId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();

        when(tripServiceClient.isParticipant(tripId, userId)).thenReturn(true);
        when(chatPresenceService.addUser(tripId, userId)).thenReturn(true);

        interceptor.preSend(createSubscribeMessage(tripId, userId, "Alice"), channel);

        verify(chatMessageService).sendMessage(
                eq(tripId), eq(userId), eq("System"),
                eq("Alice joined the chat"), any());
    }

    @Test
    @DisplayName("does not broadcast join message for already-connected user")
    void doesNotBroadcastForExistingUser() {
        UUID tripId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();

        when(tripServiceClient.isParticipant(tripId, userId)).thenReturn(true);
        when(chatPresenceService.addUser(tripId, userId)).thenReturn(false);

        interceptor.preSend(createSubscribeMessage(tripId, userId, "Alice"), channel);

        verify(chatMessageService, never()).sendMessage(any(), any(), any(), any(), any());
    }

    @Test
    @DisplayName("allows /participants subscription for verified participant without broadcasting join")
    void allowsParticipantsSubscriptionWithoutBroadcast() {
        UUID tripId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();

        when(tripServiceClient.isParticipant(tripId, userId)).thenReturn(true);

        StompHeaderAccessor accessor = StompHeaderAccessor.create(StompCommand.SUBSCRIBE);
        accessor.setDestination("/topic/trips." + tripId + ".participants");
        accessor.addNativeHeader("X-User-Id", userId.toString());
        Message<?> message = MessageBuilder.createMessage(new byte[0], accessor.getMessageHeaders());

        Message<?> result = interceptor.preSend(message, channel);

        assertThat(result).isNotNull();
        verify(tripServiceClient).isParticipant(tripId, userId);
        verify(chatPresenceService, never()).addUser(any(), any());
        verify(chatMessageService, never()).sendMessage(any(), any(), any(), any(), any());
    }

    // -------------------------------------------------------------------- SEND

    @Test
    @DisplayName("SEND passes through for non-banned, non-muted user")
    void sendPassesThroughForCleanUser() {
        UUID tripId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        when(tripServiceClient.isParticipant(tripId, userId)).thenReturn(true);
        when(moderationService.isBanned(userId)).thenReturn(false);
        when(moderationService.isMuted(userId)).thenReturn(false);

        Message<?> result = interceptor.preSend(createSendMessage(tripId, userId), channel);

        assertThat(result).isNotNull();
    }

    @Test
    @DisplayName("SEND is rejected when user is banned")
    void sendRejectedForBannedUser() {
        UUID tripId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        when(tripServiceClient.isParticipant(tripId, userId)).thenReturn(true);
        when(moderationService.isBanned(userId)).thenReturn(true);

        assertThatThrownBy(() -> interceptor.preSend(createSendMessage(tripId, userId), channel))
                .isInstanceOf(MessageDeliveryException.class)
                .hasMessageContaining("banned");
    }

    @Test
    @DisplayName("SEND is rejected when user is muted")
    void sendRejectedForMutedUser() {
        UUID tripId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        when(tripServiceClient.isParticipant(tripId, userId)).thenReturn(true);
        when(moderationService.isBanned(userId)).thenReturn(false);
        when(moderationService.isMuted(userId)).thenReturn(true);

        assertThatThrownBy(() -> interceptor.preSend(createSendMessage(tripId, userId), channel))
                .isInstanceOf(MessageDeliveryException.class)
                .hasMessageContaining("muted");
    }

    @Test
    @DisplayName("SEND with no resolvable userId is rejected")
    void sendRejectedWhenUserIdUnresolvable() {
        StompHeaderAccessor accessor = StompHeaderAccessor.create(StompCommand.SEND);
        accessor.setDestination("/app/trips/" + UUID.randomUUID() + "/send");
        Message<?> message = MessageBuilder.createMessage(new byte[0], accessor.getMessageHeaders());

        assertThatThrownBy(() -> interceptor.preSend(message, channel))
                .isInstanceOf(MessageDeliveryException.class)
                .hasMessageContaining("Unauthenticated");
        verify(moderationService, never()).isBanned(any());
    }

    @Test
    @DisplayName("SEND is rejected when user is not a trip participant")
    void sendRejectedForNonParticipant() {
        UUID tripId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        when(tripServiceClient.isParticipant(tripId, userId)).thenReturn(false);

        assertThatThrownBy(() -> interceptor.preSend(createSendMessage(tripId, userId), channel))
                .isInstanceOf(MessageDeliveryException.class)
                .hasMessageContaining("not a participant");

        verify(moderationService, never()).isBanned(any());
    }

    // ----------------------------------------------------------------- Helpers

    private Message<?> createSubscribeMessage(UUID tripId, UUID userId, String displayName) {
        StompHeaderAccessor accessor = StompHeaderAccessor.create(StompCommand.SUBSCRIBE);
        accessor.setDestination("/topic/trips." + tripId + ".messages");
        accessor.addNativeHeader("X-User-Id", userId.toString());
        accessor.addNativeHeader("X-User-DisplayName", displayName);
        return MessageBuilder.createMessage(new byte[0], accessor.getMessageHeaders());
    }

    /** Creates a SEND message with the userId in session attributes (simulates post-CONNECT state). */
    private Message<?> createSendMessage(UUID tripId, UUID userId) {
        StompHeaderAccessor accessor = StompHeaderAccessor.create(StompCommand.SEND);
        accessor.setDestination("/app/trips/" + tripId + "/send");
        accessor.setUser(new Principal() {
            @Override public String getName() { return userId.toString(); }
        });
        return MessageBuilder.createMessage(new byte[0], accessor.getMessageHeaders());
    }
}


