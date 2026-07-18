package pse.trippy.chatservice.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;
import pse.trippy.chatservice.client.TripServiceClient;
import pse.trippy.chatservice.dto.request.SendMessageRequest;
import pse.trippy.chatservice.dto.response.ChatMessageResponse;
import pse.trippy.chatservice.dto.response.MessageAttachmentResponse;
import pse.trippy.chatservice.dto.response.MessageHistoryResponse;
import pse.trippy.chatservice.model.enums.MessageType;
import pse.trippy.chatservice.service.ChatMessageService;
import pse.trippy.chatservice.service.FileStorageService;
import pse.trippy.chatservice.repository.MessageAttachmentRepository;

import java.io.IOException;
import java.time.Instant;
import java.util.UUID;

/**
 * HTTP fallback controller for sending chat messages
 * (for clients that can't use WebSocket).
 */
@RestController
@RequiredArgsConstructor
public class ChatMessageController {

    private final ChatMessageService chatMessageService;
    private final FileStorageService fileStorageService;
    private final MessageAttachmentRepository attachmentRepository;
    private final TripServiceClient tripServiceClient;

    @GetMapping("/trips/{tripId}/chat/messages")
    public ResponseEntity<MessageHistoryResponse> getMessageHistory(
            @PathVariable UUID tripId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size,
            @RequestParam(required = false) Instant before,
            @RequestHeader(value = "X-User-Id", required = false) String userId) {

        requireParticipant(tripId, userId);
        MessageHistoryResponse history = chatMessageService.getMessageHistory(tripId, page, size, before);
        return ResponseEntity.ok(history);
    }

    @PostMapping("/trips/{tripId}/chat/messages")
    public ResponseEntity<ChatMessageResponse> sendMessage(
            @PathVariable UUID tripId,
            @RequestBody @Valid SendMessageRequest request,
            @RequestHeader(value = "X-User-Id", required = false) String userId,
            @RequestHeader(value = "X-User-DisplayName", required = false) String displayName) {

        UUID senderId = requireParticipant(tripId, userId);
        String senderName = displayName != null ? displayName : "Anonymous";

        MessageType messageType;
        try {
            messageType = MessageType.valueOf(request.getType());
        } catch (IllegalArgumentException e) {
            messageType = MessageType.TEXT;
        }

        ChatMessageResponse response = chatMessageService.sendMessage(
                tripId, senderId, senderName, request.getContent(), messageType);

        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @PostMapping(value = "/trips/{tripId}/chat/messages/file", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ChatMessageResponse> uploadFile(
            @PathVariable UUID tripId,
            @RequestParam("file") MultipartFile file,
            @RequestHeader(value = "X-User-Id", required = false) String userId,
            @RequestHeader(value = "X-User-DisplayName", required = false) String displayName) throws IOException {

        UUID senderId = requireParticipant(tripId, userId);
        String senderDisplayName = displayName != null ? displayName : "Anonymous";
        ChatMessageResponse response = chatMessageService.sendFileMessage(
                tripId, senderId, senderDisplayName, file);

        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping("/chats/{tripId}/attachments")
    public ResponseEntity<java.util.List<MessageAttachmentResponse>> listAttachments(
            @PathVariable UUID tripId,
            @RequestHeader(value = "X-User-Id", required = false) String userId) {

        requireParticipant(tripId, userId);
        java.util.List<MessageAttachmentResponse> attachments = attachmentRepository.findByTripId(tripId)
                .stream()
                .map(a -> new MessageAttachmentResponse(a.getId(), a.getFileName(),
                        a.getFileUrl(), a.getFileSize(), a.getContentType(), a.getThumbnailUrl()))
                .toList();
        return ResponseEntity.ok(attachments);
    }

    @GetMapping("/chats/files/{tripId}/{filename}")
    public ResponseEntity<Resource> downloadFile(
            @PathVariable UUID tripId,
            @PathVariable String filename) {

        validateFilename(filename);
        String filePath = tripId + "/" + filename;
        Resource resource = fileStorageService.getFile(filePath);

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=\"" + resource.getFilename() + "\"")
                .body(resource);
    }

    @GetMapping("/chats/files/{tripId}/thumbs/{filename}")
    public ResponseEntity<Resource> downloadThumbnail(
            @PathVariable UUID tripId,
            @PathVariable String filename) {

        validateFilename(filename);
        String filePath = tripId + "/thumbs/" + filename;
        Resource resource = fileStorageService.getFile(filePath);

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "inline; filename=\"" + resource.getFilename() + "\"")
                .header(HttpHeaders.CONTENT_TYPE, "image/jpeg")
                .body(resource);
    }

    private void validateFilename(String filename) {
        if (filename.contains("..") || filename.contains("/") || filename.contains("\\")) {
            throw new IllegalArgumentException("Invalid filename");
        }
    }

    private UUID requireParticipant(UUID tripId, String userId) {
        if (userId == null || userId.isBlank()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Missing authenticated user");
        }

        UUID parsedUserId;
        try {
            parsedUserId = UUID.fromString(userId);
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid authenticated user");
        }

        if (!tripServiceClient.isParticipant(tripId, parsedUserId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "User is not a trip participant");
        }
        return parsedUserId;
    }
}
