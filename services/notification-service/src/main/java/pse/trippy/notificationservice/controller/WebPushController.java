package pse.trippy.notificationservice.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import pse.trippy.notificationservice.dto.WebPushSubscriptionRequest;
import pse.trippy.notificationservice.service.WebPushService;

import java.util.Map;

@RestController
@RequestMapping("/notifications/push")
@RequiredArgsConstructor
@Slf4j
@Tag(name = "Web Push Notifications", description = "Endpoints for browser push notification registration and VAPID key retrieval")
public class WebPushController {

    private final WebPushService webPushService;

    @Operation(summary = "Get VAPID public key", description = "Retrieves the server's public VAPID key required by browsers to subscribe to Web Push notifications.")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Successfully retrieved VAPID public key")
    })
    @GetMapping("/vapid-public-key")
    public ResponseEntity<Map<String, String>> getVapidPublicKey() {
        return ResponseEntity.ok(Map.of("publicKey", webPushService.getPublicKey()));
    }

    @Operation(summary = "Subscribe to Web Push notifications", description = "Registers browser PushSubscription details (endpoint, auth, p256dh) for a specific user.")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "204", description = "Web Push subscription saved successfully")
    })
    @PostMapping("/subscribe")
    public ResponseEntity<Void> subscribe(
            @Parameter(description = "Authenticated user ID header") @RequestHeader("X-User-Id") String userId,
            @Valid @RequestBody WebPushSubscriptionRequest request) {
        log.info("Received web push subscription for user: {}", userId);
        webPushService.subscribe(
                userId,
                request.getEndpoint(),
                request.getKeys().getP256dh(),
                request.getKeys().getAuth()
        );
        return ResponseEntity.noContent().build();
    }

    @Operation(summary = "Unsubscribe from Web Push notifications", description = "Removes a browser Web Push subscription by target endpoint URL.")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "204", description = "Subscription removed successfully")
    })
    @PostMapping("/unsubscribe")
    public ResponseEntity<Void> unsubscribe(
            @Parameter(description = "Authenticated user ID header") @RequestHeader("X-User-Id") String userId,
            @Valid @RequestBody WebPushSubscriptionRequest request) {
        log.info("Removing web push subscription for user: {}", userId);
        webPushService.unsubscribe(userId, request.getEndpoint());
        return ResponseEntity.noContent().build();
    }
}
