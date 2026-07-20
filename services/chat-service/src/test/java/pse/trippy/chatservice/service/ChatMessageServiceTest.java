package pse.trippy.chatservice.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import pse.trippy.chatservice.client.TripServiceClient;
import pse.trippy.chatservice.config.ChatEventRabbitConfig;
import pse.trippy.chatservice.dto.response.ChatMessageResponse;
import pse.trippy.chatservice.dto.response.MessageHistoryResponse;
import pse.trippy.chatservice.model.entity.ChatMessage;
import pse.trippy.chatservice.model.entity.ChatRoom;
import pse.trippy.chatservice.model.enums.MessageType;
import pse.trippy.chatservice.repository.ChatMessageRepository;
import pse.trippy.chatservice.repository.MessageAttachmentRepository;

import java.time.Instant;
import java.util.Collections;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.never;

@ExtendWith(MockitoExtension.class)
@DisplayName("ChatMessageService")
class ChatMessageServiceTest {

    @Mock
    private ChatMessageRepository chatMessageRepository;

    @Mock
    private MessageAttachmentRepository messageAttachmentRepository;

    @Mock
    private ChatRoomService chatRoomService;

    @Mock
    private FileStorageService fileStorageService;

    @Mock
    private SimpMessagingTemplate messagingTemplate;

    @Mock
    private RabbitTemplate rabbitTemplate;

    @Mock
    private TripServiceClient tripServiceClient;

    @InjectMocks
    private ChatMessageService chatMessageService;

    @Test
    @DisplayName("sendMessage persists and broadcasts")
    void sendMessagePersistsAndBroadcasts() {
        UUID tripId = UUID.randomUUID();
        UUID senderId = UUID.randomUUID();
        UUID roomId = UUID.randomUUID();
        UUID msgId = UUID.randomUUID();
        String content = "Hello everyone!";

        ChatRoom room = ChatRoom.builder().id(roomId).tripId(tripId).createdAt(Instant.now()).build();
        when(chatRoomService.getOrCreateRoomByTripId(tripId)).thenReturn(room);
        when(chatMessageRepository.save(any(ChatMessage.class))).thenAnswer(inv -> {
            ChatMessage m = inv.getArgument(0);
            m.setId(msgId);
            m.prePersist();
            return m;
        });
        when(messageAttachmentRepository.findByMessageId(any())).thenReturn(Collections.emptyList());
        UUID recipientId = UUID.randomUUID();
        when(tripServiceClient.getAcceptedParticipantIds(tripId, senderId))
            .thenReturn(List.of(senderId, recipientId));

        ChatMessageResponse response = chatMessageService.sendMessage(
                tripId, senderId, "Alice", content, MessageType.TEXT);

        // Verify persistence
        assertThat(response.getId()).isEqualTo(msgId);
        assertThat(response.getSenderId()).isEqualTo(senderId);
        assertThat(response.getSenderDisplayName()).isEqualTo("Alice");
        assertThat(response.getContent()).isEqualTo(content);
        assertThat(response.getType()).isEqualTo("TEXT");

        // Verify saved entity
        ArgumentCaptor<ChatMessage> captor = ArgumentCaptor.forClass(ChatMessage.class);
        verify(chatMessageRepository).save(captor.capture());
        ChatMessage saved = captor.getValue();
        assertThat(saved.getChatRoom().getId()).isEqualTo(roomId);
        assertThat(saved.getSenderId()).isEqualTo(senderId);
        assertThat(saved.getContent()).isEqualTo(content);

        // Verify broadcast
        verify(messagingTemplate).convertAndSend(
                eq("/topic/trips." + tripId + ".messages"),
                any(ChatMessageResponse.class));
        verify(rabbitTemplate).convertAndSend(
            eq(ChatEventRabbitConfig.TRIP_EXCHANGE),
            eq(ChatEventRabbitConfig.CHAT_MESSAGE_ROUTING_KEY),
            any(Object.class));
    }

    @Test
    @DisplayName("deleted messages return placeholder content")
    void deletedMessagesReturnPlaceholder() {
        UUID tripId = UUID.randomUUID();
        UUID senderId = UUID.randomUUID();
        ChatRoom room = ChatRoom.builder().id(UUID.randomUUID()).tripId(tripId).createdAt(Instant.now()).build();

        when(chatRoomService.getOrCreateRoomByTripId(tripId)).thenReturn(room);
        when(chatMessageRepository.save(any(ChatMessage.class))).thenAnswer(inv -> {
            ChatMessage m = inv.getArgument(0);
            m.setId(UUID.randomUUID());
            m.setDeleted(true);
            m.prePersist();
            return m;
        });
        when(messageAttachmentRepository.findByMessageId(any())).thenReturn(Collections.emptyList());

        ChatMessageResponse response = chatMessageService.sendMessage(
                tripId, senderId, "Bob", "secret", MessageType.TEXT);

        assertThat(response.getContent()).isEqualTo("This message was deleted");
    }

    @Test
    @DisplayName("system messages do not create user notifications")
    void systemMessagesDoNotCreateNotifications() {
        UUID tripId = UUID.randomUUID();
        UUID senderId = UUID.randomUUID();
        ChatRoom room = ChatRoom.builder().id(UUID.randomUUID()).tripId(tripId).createdAt(Instant.now()).build();
        when(chatRoomService.getOrCreateRoomByTripId(tripId)).thenReturn(room);
        when(chatMessageRepository.save(any(ChatMessage.class))).thenAnswer(invocation -> {
            ChatMessage message = invocation.getArgument(0);
            message.setId(UUID.randomUUID());
            message.prePersist();
            return message;
        });
        when(messageAttachmentRepository.findByMessageId(any())).thenReturn(Collections.emptyList());

        chatMessageService.sendMessage(tripId, senderId, "System", "Alice joined", MessageType.SYSTEM);

        verify(tripServiceClient, never()).getAcceptedParticipantIds(any(), any());
        verify(rabbitTemplate, never()).convertAndSend(any(String.class), any(String.class), any(Object.class));
    }

    @Test
    @DisplayName("getMessageHistory returns paginated messages without before filter")
    void getMessageHistoryReturnsPaginatedMessages() {
        UUID tripId = UUID.randomUUID();
        UUID roomId = UUID.randomUUID();
        ChatRoom room = ChatRoom.builder().id(roomId).tripId(tripId).createdAt(Instant.now()).build();
        when(chatRoomService.getOrCreateRoomByTripId(tripId)).thenReturn(room);

        ChatMessage msg1 = ChatMessage.builder()
                .id(UUID.randomUUID()).chatRoom(room).senderId(UUID.randomUUID())
                .senderDisplayName("Alice").content("Hello").messageType(MessageType.TEXT).build();
        msg1.prePersist();
        ChatMessage msg2 = ChatMessage.builder()
                .id(UUID.randomUUID()).chatRoom(room).senderId(UUID.randomUUID())
                .senderDisplayName("Bob").content("Hi").messageType(MessageType.TEXT).build();
        msg2.prePersist();

        PageImpl<ChatMessage> page = new PageImpl<>(List.of(msg1, msg2), PageRequest.of(0, 50), 2);
        when(chatMessageRepository.findByChatRoomIdOrderByCreatedAtDesc(roomId, PageRequest.of(0, 50)))
                .thenReturn(page);
        when(messageAttachmentRepository.findByMessageId(any())).thenReturn(Collections.emptyList());

        MessageHistoryResponse history = chatMessageService.getMessageHistory(tripId, 0, 50, null);

        assertThat(history.getMessages()).hasSize(2);
        assertThat(history.getPage()).isZero();
        assertThat(history.getSize()).isEqualTo(50);
        assertThat(history.getTotalMessages()).isEqualTo(2);
        assertThat(history.isHasMore()).isFalse();
    }

    @Test
    @DisplayName("getMessageHistory filters by before timestamp")
    void getMessageHistoryFiltersByBefore() {
        UUID tripId = UUID.randomUUID();
        UUID roomId = UUID.randomUUID();
        Instant before = Instant.now();
        ChatRoom room = ChatRoom.builder().id(roomId).tripId(tripId).createdAt(Instant.now()).build();
        when(chatRoomService.getOrCreateRoomByTripId(tripId)).thenReturn(room);

        PageImpl<ChatMessage> page = new PageImpl<>(List.of(), PageRequest.of(0, 50), 0);
        when(chatMessageRepository.findByChatRoomIdAndCreatedAtBeforeOrderByCreatedAtDesc(
                roomId, before, PageRequest.of(0, 50))).thenReturn(page);

        MessageHistoryResponse history = chatMessageService.getMessageHistory(tripId, 0, 50, before);

        assertThat(history.getMessages()).isEmpty();
        assertThat(history.getTotalMessages()).isZero();
        assertThat(history.isHasMore()).isFalse();
    }
}
