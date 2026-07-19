package pse.trippy.chatservice.controller;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.messaging.handler.annotation.SendTo;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.simp.stomp.StompCommand;
import pse.trippy.chatservice.config.WebSocketAuthChannelInterceptor;
import pse.trippy.chatservice.dto.request.SendMessageRequest;
import pse.trippy.chatservice.dto.response.ChatMessageResponse;
import pse.trippy.chatservice.model.enums.MessageType;
import pse.trippy.chatservice.service.ChatMessageService;

import java.security.Principal;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@DisplayName("ChatWebSocketController")
class ChatWebSocketControllerTest {

    @Mock
    private ChatMessageService chatMessageService;

        @Mock
    private WebSocketAuthChannelInterceptor authChannelInterceptor;

    @InjectMocks
    private ChatWebSocketController controller;

    @Test
    @DisplayName("delegates to the service as the single message publisher")
    void delegatesToSingleMessagePublisher() throws NoSuchMethodException {
        UUID tripId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        Principal principal = () -> userId.toString();
        StompHeaderAccessor accessor = StompHeaderAccessor.create(StompCommand.SEND);
        SendMessageRequest request = SendMessageRequest.builder().content("Hello").build();
        ChatMessageResponse expected = ChatMessageResponse.builder().id(UUID.randomUUID()).build();

        when(authChannelInterceptor.resolveDisplayName(accessor)).thenReturn("Alice");
        when(chatMessageService.sendMessage(
                tripId, userId, "Alice", "Hello", MessageType.TEXT)).thenReturn(expected);

        ChatMessageResponse actual = controller.sendMessage(tripId, accessor, principal, request);

        assertThat(actual).isSameAs(expected);
        verify(chatMessageService).sendMessage(
                tripId, userId, "Alice", "Hello", MessageType.TEXT);
        assertThat(ChatWebSocketController.class.getDeclaredMethod(
                "sendMessage", UUID.class, StompHeaderAccessor.class,
                Principal.class, SendMessageRequest.class).getAnnotation(SendTo.class)).isNull();
    }
}