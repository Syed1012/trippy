package pse.trippy.notificationservice.service;

import jakarta.annotation.PreDestroy;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import pse.trippy.notificationservice.dto.response.NotificationResponse;

import java.io.IOException;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

@Service
@Slf4j
public class SseNotificationService {

    private final Map<UUID, SseEmitter> emitters = new ConcurrentHashMap<>();
    private final ScheduledExecutorService heartbeatExecutor = Executors.newSingleThreadScheduledExecutor(r -> {
        Thread thread = new Thread(r, "sse-heartbeat");
        thread.setDaemon(true);
        return thread;
    });

    public SseNotificationService() {
        // Start sending heartbeats every 15 seconds to keep connections alive
        heartbeatExecutor.scheduleAtFixedRate(this::sendHeartbeats, 15, 15, TimeUnit.SECONDS);
    }

    public SseEmitter createEmitter(UUID userId) {
        // Use a timeout of 30 minutes
        SseEmitter emitter = new SseEmitter(1800000L);

        emitters.put(userId, emitter);

        emitter.onCompletion(() -> {
            log.info("SSE connection completed for user {}", userId);
            emitters.remove(userId);
        });

        emitter.onTimeout(() -> {
            log.info("SSE connection timeout for user {}", userId);
            emitter.complete();
            emitters.remove(userId);
        });

        emitter.onError(ex -> {
            log.warn("SSE connection error for user {}: {}", userId, ex.getMessage());
            emitter.completeWithError(ex);
            emitters.remove(userId);
        });

        // Send initial connection event
        try {
            emitter.send(SseEmitter.event()
                    .name("connection")
                    .data("connected"));
        } catch (IOException e) {
            log.error("Failed to send initial SSE connection event for user {}", userId, e);
            emitter.complete();
            emitters.remove(userId);
        }

        return emitter;
    }

    public void sendNotification(UUID userId, NotificationResponse notification) {
        SseEmitter emitter = emitters.get(userId);
        if (emitter != null) {
            try {
                emitter.send(SseEmitter.event()
                        .name("notification")
                        .data(notification));
                log.info("Sent SSE notification to user {}", userId);
            } catch (IOException e) {
                log.error("Failed to send SSE notification to user {}", userId, e);
                emitter.complete();
                emitters.remove(userId);
            }
        }
    }

    private void sendHeartbeats() {
        emitters.forEach((userId, emitter) -> {
            try {
                emitter.send(SseEmitter.event().comment("ping"));
            } catch (IOException e) {
                log.debug("Failed to send SSE heartbeat for user {}, removing emitter", userId);
                emitter.complete();
                emitters.remove(userId);
            }
        });
    }

    @PreDestroy
    public void shutdown() {
        heartbeatExecutor.shutdown();
    }
}
