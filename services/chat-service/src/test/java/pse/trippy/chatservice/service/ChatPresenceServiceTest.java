package pse.trippy.chatservice.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.data.redis.core.SetOperations;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@DisplayName("ChatPresenceService (Redis-backed)")
class ChatPresenceServiceTest {

    @Mock
    private StringRedisTemplate redisTemplate;

    @Mock
    private SetOperations<String, String> setOps;

    @Mock
    private SimpMessagingTemplate messagingTemplate;

    @Mock
    private ObjectProvider<SimpMessagingTemplate> messagingTemplateProvider;

    private ChatPresenceService presenceService;

    private UUID tripId;
    private UUID userId;

    @BeforeEach
    void setUp() {
        tripId = UUID.randomUUID();
        userId = UUID.randomUUID();

        lenient().when(redisTemplate.opsForSet()).thenReturn(setOps);
        lenient().when(messagingTemplateProvider.getObject()).thenReturn(messagingTemplate);

        presenceService = new ChatPresenceService(redisTemplate, messagingTemplateProvider);
    }

    // ---------------------------------------------------------------- addUser

    @Test
    @DisplayName("addUser: first join returns true and broadcasts")
    void addUser_firstJoin_returnsTrueAndBroadcasts() {
        String key = "presence:trip:" + tripId;
        when(setOps.add(eq(key), eq(userId.toString()))).thenReturn(1L);
        when(setOps.members(key)).thenReturn(Set.of(userId.toString()));

        boolean result = presenceService.addUser(tripId, userId);

        assertThat(result).isTrue();
        verify(redisTemplate).expire(eq(key), eq(ChatPresenceService.PRESENCE_TTL));
        verify(messagingTemplate).convertAndSend(
                eq("/topic/trips." + tripId + ".participants"),
                any(Set.class));
    }

    @Test
    @DisplayName("addUser: duplicate join returns false and does not broadcast")
    void addUser_duplicate_returnsFalseNoBroadcast() {
        String key = "presence:trip:" + tripId;
        when(setOps.add(eq(key), eq(userId.toString()))).thenReturn(0L);

        boolean result = presenceService.addUser(tripId, userId);

        assertThat(result).isFalse();
        verify(messagingTemplate, never()).convertAndSend(anyString(), any(Object.class));
    }

    // --------------------------------------------------------------- removeUser

    @Test
    @DisplayName("removeUser: present user is removed and update is broadcast")
    void removeUser_presentUser_broadcastsUpdate() {
        String key = "presence:trip:" + tripId;
        when(setOps.remove(eq(key), eq(userId.toString()))).thenReturn(1L);
        when(setOps.members(key)).thenReturn(Set.of());

        presenceService.removeUser(tripId, userId);

        verify(messagingTemplate).convertAndSend(
                eq("/topic/trips." + tripId + ".participants"),
                any(Set.class));
    }

    @Test
    @DisplayName("removeUser: absent user does nothing")
    void removeUser_absentUser_doesNotBroadcast() {
        String key = "presence:trip:" + tripId;
        when(setOps.remove(eq(key), eq(userId.toString()))).thenReturn(0L);

        presenceService.removeUser(tripId, userId);

        verify(messagingTemplate, never()).convertAndSend(anyString(), any(Object.class));
    }

    // -------------------------------------------------------- getConnectedUsers

    @Test
    @DisplayName("getConnectedUsers: maps Redis strings back to UUIDs")
    void getConnectedUsers_mapsStringsToUUIDs() {
        UUID userA = UUID.randomUUID();
        UUID userB = UUID.randomUUID();
        String key = "presence:trip:" + tripId;
        when(setOps.members(key)).thenReturn(Set.of(userA.toString(), userB.toString()));

        Set<UUID> result = presenceService.getConnectedUsers(tripId);

        assertThat(result).containsExactlyInAnyOrder(userA, userB);
    }

    @Test
    @DisplayName("getConnectedUsers: empty room returns empty set")
    void getConnectedUsers_emptyRoom_returnsEmptySet() {
        when(setOps.members(anyString())).thenReturn(Set.of());

        Set<UUID> result = presenceService.getConnectedUsers(tripId);

        assertThat(result).isEmpty();
    }
}
