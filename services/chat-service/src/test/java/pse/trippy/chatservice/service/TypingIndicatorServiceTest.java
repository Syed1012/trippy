package pse.trippy.chatservice.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import pse.trippy.chatservice.dto.event.TypingEvent;

import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@DisplayName("TypingIndicatorService")
class TypingIndicatorServiceTest {

    @Mock
    private StringRedisTemplate redisTemplate;

    @Mock
    private ValueOperations<String, String> valueOps;

    @Mock
    private SimpMessagingTemplate messagingTemplate;

    @Mock
    private ObjectProvider<SimpMessagingTemplate> messagingTemplateProvider;

    private TypingIndicatorService typingService;

    private UUID tripId;
    private UUID userId;

    @BeforeEach
    void setUp() {
        tripId = UUID.randomUUID();
        userId = UUID.randomUUID();
        lenient().when(redisTemplate.opsForValue()).thenReturn(valueOps);
        lenient().when(messagingTemplateProvider.getObject()).thenReturn(messagingTemplate);
        typingService = new TypingIndicatorService(redisTemplate, messagingTemplateProvider);
    }

    // ---------------------------------------------------------- startedTyping

    @Test
    @DisplayName("userStartedTyping: broadcasts typing=true when key is new")
    void startedTyping_newKey_broadcastsTrue() {
        String key = "typing:trip:" + tripId + ":user:" + userId;
        when(valueOps.setIfAbsent(eq(key), eq("1"), eq(TypingIndicatorService.TYPING_TTL))).thenReturn(true);

        typingService.userStartedTyping(tripId, userId, "Alice");

        verify(valueOps).setIfAbsent(eq(key), eq("1"), eq(TypingIndicatorService.TYPING_TTL));
        verify(messagingTemplate).convertAndSend(
                eq("/topic/trips." + tripId + ".typing"), any(TypingEvent.class));
    }

    @Test
    @DisplayName("userStartedTyping: debounce — refreshes TTL but no broadcast when already typing")
    void startedTyping_existingKey_refreshesTtlNoBroadcast() {
        String key = "typing:trip:" + tripId + ":user:" + userId;
        when(valueOps.setIfAbsent(eq(key), eq("1"), eq(TypingIndicatorService.TYPING_TTL))).thenReturn(false);

        typingService.userStartedTyping(tripId, userId, "Alice");

        verify(redisTemplate).expire(eq(key), eq(TypingIndicatorService.TYPING_TTL));
        verify(messagingTemplate, never()).convertAndSend(anyString(), any(Object.class));
    }

    // ---------------------------------------------------------- stoppedTyping

    @Test
    @DisplayName("userStoppedTyping: broadcasts typing=false when key existed")
    void stoppedTyping_keyExisted_broadcastsFalse() {
        String key = "typing:trip:" + tripId + ":user:" + userId;
        when(redisTemplate.hasKey(key)).thenReturn(true);

        typingService.userStoppedTyping(tripId, userId, "Alice");

        verify(redisTemplate).delete(key);
        verify(messagingTemplate).convertAndSend(
                eq("/topic/trips." + tripId + ".typing"), any(TypingEvent.class));
    }

    @Test
    @DisplayName("userStoppedTyping: no broadcast when key did not exist")
    void stoppedTyping_keyAbsent_noBroadcast() {
        String key = "typing:trip:" + tripId + ":user:" + userId;
        when(redisTemplate.hasKey(key)).thenReturn(false);

        typingService.userStoppedTyping(tripId, userId, "Alice");

        verify(messagingTemplate, never()).convertAndSend(anyString(), any(Object.class));
    }
}
