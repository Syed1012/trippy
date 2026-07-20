package pse.trippy.notificationservice.service;

import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

class SseNotificationServiceTest {

    private final SseNotificationService service = new SseNotificationService();

    @AfterEach
    void tearDown() {
        service.shutdown();
    }

    @Test
    void retainsConcurrentConnectionsForTheSameUser() {
        UUID userId = UUID.randomUUID();

        SseEmitter first = service.createEmitter(userId);
        SseEmitter second = service.createEmitter(userId);

        Map<UUID, Set<SseEmitter>> emitters = emitterMap();
        assertThat(emitters.get(userId)).containsExactlyInAnyOrder(first, second);
    }

    @SuppressWarnings("unchecked")
    private Map<UUID, Set<SseEmitter>> emitterMap() {
        return (Map<UUID, Set<SseEmitter>>) ReflectionTestUtils.getField(service, "emitters");
    }
}