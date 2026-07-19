package pse.trippy.chatservice.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pse.trippy.chatservice.dto.response.ChatRoomResponse;
import pse.trippy.chatservice.exception.ChatRoomAlreadyExistsException;
import pse.trippy.chatservice.exception.ChatRoomNotFoundException;
import pse.trippy.chatservice.model.entity.ChatRoom;
import pse.trippy.chatservice.repository.ChatRoomRepository;

import java.util.UUID;

/**
 * Service for managing chat rooms.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ChatRoomService {

    private final ChatRoomRepository chatRoomRepository;

    @Transactional
    public ChatRoomResponse createRoom(UUID tripId) {
        if (chatRoomRepository.existsByTripId(tripId)) {
            throw new ChatRoomAlreadyExistsException(tripId.toString());
        }

        ChatRoom room = chatRoomRepository.save(ChatRoom.builder()
                .tripId(tripId)
                .build());

        log.info("Chat room created: id={} tripId={}", room.getId(), tripId);

        return ChatRoomResponse.builder()
                .id(room.getId())
                .tripId(room.getTripId())
                .createdAt(room.getCreatedAt())
                .build();
    }

    public ChatRoom getRoomByTripId(UUID tripId) {
        return chatRoomRepository.findByTripId(tripId)
                .orElseThrow(() -> new ChatRoomNotFoundException(tripId.toString()));
    }

    @Transactional
    public ChatRoom getOrCreateRoomByTripId(UUID tripId) {
        return chatRoomRepository.findByTripId(tripId)
                .orElseGet(() -> {
                    log.info("Creating chat room lazily for trip {}", tripId);
                    return chatRoomRepository.save(ChatRoom.builder()
                            .tripId(tripId)
                            .build());
                });
    }
}
