package pse.trippy.chatservice.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import pse.trippy.chatservice.dto.response.ChatMessageResponse;
import pse.trippy.chatservice.dto.response.FileStorageResult;
import pse.trippy.chatservice.dto.response.MessageAttachmentResponse;
import pse.trippy.chatservice.dto.response.MessageHistoryResponse;
import pse.trippy.chatservice.model.entity.ChatMessage;
import pse.trippy.chatservice.model.entity.ChatRoom;
import pse.trippy.chatservice.model.entity.MessageAttachment;
import pse.trippy.chatservice.model.enums.MessageType;
import pse.trippy.chatservice.repository.ChatMessageRepository;
import pse.trippy.chatservice.repository.MessageAttachmentRepository;

import java.io.IOException;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Service for persisting and broadcasting chat messages.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ChatMessageService {

    private final ChatMessageRepository chatMessageRepository;
    private final MessageAttachmentRepository messageAttachmentRepository;
    private final ChatRoomService chatRoomService;
    private final FileStorageService fileStorageService;
    private final SimpMessagingTemplate messagingTemplate;

    /**
     * Persists a message and broadcasts it to the STOMP topic.
     */
    @Transactional
    public ChatMessageResponse sendMessage(UUID tripId, UUID senderId,
                                           String senderDisplayName, String content,
                                           MessageType messageType) {

        ChatRoom room = chatRoomService.getOrCreateRoomByTripId(tripId);

        ChatMessage message = chatMessageRepository.save(ChatMessage.builder()
                .chatRoom(room)
                .senderId(senderId)
                .senderDisplayName(senderDisplayName)
                .content(content)
                .messageType(messageType)
                .build());

        log.debug("Message {} persisted in room {} for trip {}",
                message.getId(), room.getId(), tripId);

        ChatMessageResponse response = toResponse(message);

        // Broadcast to STOMP subscribers
        messagingTemplate.convertAndSend(
                "/topic/trips." + tripId + ".messages", response);

        return response;
    }

    /**
     * Returns paginated message history for a trip, newest first.
     * If {@code before} is provided, only returns messages created before that timestamp.
     */
    @Transactional(readOnly = true)
    public MessageHistoryResponse getMessageHistory(UUID tripId, int page, int size, Instant before) {
        ChatRoom room = chatRoomService.getOrCreateRoomByTripId(tripId);
        PageRequest pageRequest = PageRequest.of(page, size);

        Page<ChatMessage> messagePage;
        if (before != null) {
            messagePage = chatMessageRepository
                    .findByChatRoomIdAndCreatedAtBeforeOrderByCreatedAtDesc(room.getId(), before, pageRequest);
        } else {
            messagePage = chatMessageRepository
                    .findByChatRoomIdOrderByCreatedAtDesc(room.getId(), pageRequest);
        }

        return MessageHistoryResponse.builder()
                .messages(messagePage.getContent().stream().map(this::toResponse).toList())
                .page(messagePage.getNumber())
                .size(messagePage.getSize())
                .totalMessages(messagePage.getTotalElements())
                .hasMore(messagePage.hasNext())
                .build();
    }

    /**
     * Stores a file attachment and persists a FILE or IMAGE message.
     */
    @Transactional
    public ChatMessageResponse sendFileMessage(UUID tripId, UUID senderId,
                                               String senderDisplayName,
                                               MultipartFile file) throws IOException {

        FileStorageResult stored = fileStorageService.storeFile(tripId, file);

        MessageType type = isImageContentType(stored.contentType())
                ? MessageType.IMAGE
                : MessageType.FILE;

        ChatRoom room = chatRoomService.getOrCreateRoomByTripId(tripId);

        ChatMessage message = chatMessageRepository.save(ChatMessage.builder()
                .chatRoom(room)
                .senderId(senderId)
                .senderDisplayName(senderDisplayName)
                .content(stored.fileName())
                .messageType(type)
                .build());

        MessageAttachment attachment = messageAttachmentRepository.save(MessageAttachment.builder()
                .messageId(message.getId())
                .fileName(stored.fileName())
                .fileUrl(stored.fileUrl())
                .fileSize(stored.fileSize())
                .contentType(stored.contentType())
                .thumbnailUrl(stored.thumbnailUrl())
                .build());

        log.debug("File message {} with attachment {} persisted in room {} for trip {}",
                message.getId(), attachment.getId(), room.getId(), tripId);

        ChatMessageResponse response = toResponse(message, attachment);

        messagingTemplate.convertAndSend(
                "/topic/trips." + tripId + ".messages", response);

        return response;
    }

    private boolean isImageContentType(String contentType) {
        return contentType != null && contentType.startsWith("image/");
    }

    private ChatMessageResponse toResponse(ChatMessage msg) {
        List<MessageAttachment> attachments = messageAttachmentRepository.findByMessageId(msg.getId());
        MessageAttachment attachment = attachments.isEmpty() ? null : attachments.getFirst();
        return toResponse(msg, attachment);
    }

    private ChatMessageResponse toResponse(ChatMessage msg, MessageAttachment attachment) {
        MessageAttachmentResponse attachmentResponse = attachment == null ? null
                : new MessageAttachmentResponse(
                        attachment.getId(),
                        attachment.getFileName(),
                        attachment.getFileUrl(),
                        attachment.getFileSize(),
                        attachment.getContentType(),
                        attachment.getThumbnailUrl());

        return ChatMessageResponse.builder()
                .id(msg.getId())
                .senderId(msg.getSenderId())
                .senderDisplayName(msg.getSenderDisplayName())
                .content(msg.isDeleted() ? "This message was deleted" : msg.getContent())
                .type(msg.getMessageType().name())
                .createdAt(msg.getCreatedAt())
                .edited(msg.getEditedAt() != null)
                .attachment(attachmentResponse)
                .build();
    }
}
