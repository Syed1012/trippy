package pse.trippy.chatservice.config;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.messaging.support.MessageBuilder;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;
import pse.trippy.chatservice.service.ChatPresenceService;

import java.util.UUID;

import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
@DisplayName("WebSocketDisconnectListener")
class WebSocketDisconnectListenerTest {

    @Mock
    private ChatPresenceService chatPresenceService;

    @InjectMocks
    private WebSocketDisconnectListener listener;

    @Test
    @DisplayName("transport disconnect schedules cleanup without publishing a leave message")
    void disconnectSchedulesPresenceCleanup() {
        String sessionId = UUID.randomUUID().toString();
        UUID tripId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        listener.trackSubscription(sessionId, tripId, userId, "Alice");

        var message = MessageBuilder.withPayload(new byte[0])
                .setHeader("simpSessionId", sessionId)
                .build();
        var event = new SessionDisconnectEvent(this, message, sessionId, CloseStatus.NORMAL);

        listener.handleSessionDisconnect(event);

        verify(chatPresenceService).scheduleRemoval(tripId, userId);
    }
}