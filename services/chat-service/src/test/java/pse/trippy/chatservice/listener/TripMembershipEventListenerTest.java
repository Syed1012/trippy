package pse.trippy.chatservice.listener;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import pse.trippy.chatservice.model.enums.MessageType;
import pse.trippy.chatservice.service.ChatMessageService;

import java.util.Map;
import java.util.UUID;

import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class TripMembershipEventListenerTest {

    @Mock
    private ChatMessageService chatMessageService;

    @InjectMocks
    private TripMembershipEventListener listener;

    @Test
    void joinedEventCreatesOneSystemMessage() {
        UUID tripId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();

        listener.handleMembershipEvent(Map.of(
                "eventType", "trip.participant.joined",
                "tripId", tripId.toString(),
                "userId", userId.toString(),
                "displayName", "Alice"));

        verify(chatMessageService).sendMessage(
                tripId, userId, "System", "Alice joined the chat", MessageType.SYSTEM);
    }

    @Test
    void leftEventCreatesOneSystemMessage() {
        UUID tripId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();

        listener.handleMembershipEvent(Map.of(
                "eventType", "trip.participant.left",
                "tripId", tripId.toString(),
                "userId", userId.toString(),
                "displayName", "Alice"));

        verify(chatMessageService).sendMessage(
                tripId, userId, "System", "Alice left the chat", MessageType.SYSTEM);
    }
}