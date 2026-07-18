package pse.trippy.chatservice.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import pse.trippy.chatservice.dto.response.ChatRoomResponse;
import pse.trippy.chatservice.exception.ChatRoomAlreadyExistsException;
import pse.trippy.chatservice.exception.ChatRoomNotFoundException;
import pse.trippy.chatservice.model.entity.ChatRoom;
import pse.trippy.chatservice.repository.ChatRoomRepository;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@DisplayName("ChatRoomService")
class ChatRoomServiceTest {

    @Mock
    private ChatRoomRepository chatRoomRepository;

    @InjectMocks
    private ChatRoomService chatRoomService;

    @Test
    @DisplayName("createRoom succeeds for new trip")
    void createRoomSucceeds() {
        UUID tripId = UUID.randomUUID();
        UUID roomId = UUID.randomUUID();

        when(chatRoomRepository.existsByTripId(tripId)).thenReturn(false);
        when(chatRoomRepository.save(any(ChatRoom.class))).thenAnswer(inv -> {
            ChatRoom r = inv.getArgument(0);
            r.setId(roomId);
            r.prePersist();
            return r;
        });

        ChatRoomResponse response = chatRoomService.createRoom(tripId);

        assertThat(response.getId()).isEqualTo(roomId);
        assertThat(response.getTripId()).isEqualTo(tripId);
        assertThat(response.getCreatedAt()).isNotNull();

        ArgumentCaptor<ChatRoom> captor = ArgumentCaptor.forClass(ChatRoom.class);
        verify(chatRoomRepository).save(captor.capture());
        assertThat(captor.getValue().getTripId()).isEqualTo(tripId);
    }

    @Test
    @DisplayName("createRoom throws for duplicate trip")
    void createRoomThrowsForDuplicate() {
        UUID tripId = UUID.randomUUID();
        when(chatRoomRepository.existsByTripId(tripId)).thenReturn(true);

        assertThatThrownBy(() -> chatRoomService.createRoom(tripId))
                .isInstanceOf(ChatRoomAlreadyExistsException.class);

        verify(chatRoomRepository, never()).save(any());
    }

    @Test
    @DisplayName("getRoomByTripId returns room when exists")
    void getRoomByTripIdReturnsRoom() {
        UUID tripId = UUID.randomUUID();
        ChatRoom room = ChatRoom.builder().id(UUID.randomUUID()).tripId(tripId).createdAt(Instant.now()).build();

        when(chatRoomRepository.findByTripId(tripId)).thenReturn(Optional.of(room));

        ChatRoom result = chatRoomService.getRoomByTripId(tripId);
        assertThat(result.getTripId()).isEqualTo(tripId);
    }

    @Test
    @DisplayName("getRoomByTripId throws when not found")
    void getRoomByTripIdThrowsWhenNotFound() {
        UUID tripId = UUID.randomUUID();
        when(chatRoomRepository.findByTripId(tripId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> chatRoomService.getRoomByTripId(tripId))
                .isInstanceOf(ChatRoomNotFoundException.class);
    }

    @Test
    @DisplayName("getOrCreateRoomByTripId creates room when not found")
    void getOrCreateRoomByTripIdCreatesRoomWhenNotFound() {
        UUID tripId = UUID.randomUUID();
        UUID roomId = UUID.randomUUID();
        when(chatRoomRepository.findByTripId(tripId)).thenReturn(Optional.empty());
        when(chatRoomRepository.save(any(ChatRoom.class))).thenAnswer(inv -> {
            ChatRoom room = inv.getArgument(0);
            room.setId(roomId);
            room.prePersist();
            return room;
        });

        ChatRoom room = chatRoomService.getOrCreateRoomByTripId(tripId);

        assertThat(room.getId()).isEqualTo(roomId);
        assertThat(room.getTripId()).isEqualTo(tripId);
        assertThat(room.getCreatedAt()).isNotNull();
    }
}
