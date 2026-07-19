package pse.trippy.notificationservice.controller;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import pse.trippy.notificationservice.dto.WebPushSubscriptionRequest;
import pse.trippy.notificationservice.model.WebPushSubscription;
import pse.trippy.notificationservice.repository.WebPushSubscriptionRepository;
import pse.trippy.notificationservice.service.WebPushService;

import java.util.Map;

@RestController
@RequestMapping("/notifications/push")
@RequiredArgsConstructor
@Slf4j
public class WebPushController {

    private final WebPushService webPushService;

    @GetMapping("/vapid-public-key")
    public ResponseEntity<Map<String, String>> getVapidPublicKey() {
        return ResponseEntity.ok(Map.of("publicKey", webPushService.getPublicKey()));
    }

    @PostMapping("/subscribe")
    public ResponseEntity<Void> subscribe(@RequestHeader(value = "X-User-Id", defaultValue = "test-user") String userId,
                                          @RequestBody WebPushSubscriptionRequest request) {
        log.info("Received web push subscription for user: {}", userId);
        webPushService.subscribe(
                userId,
                request.getEndpoint(),
                request.getKeys().getP256dh(),
                request.getKeys().getAuth()
        );
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/unsubscribe")
    public ResponseEntity<Void> unsubscribe(@RequestBody WebPushSubscriptionRequest request) {
        log.info("Removing web push subscription for endpoint: {}", request.getEndpoint());
        webPushService.unsubscribe(request.getEndpoint());
        return ResponseEntity.noContent().build();
    }
}
