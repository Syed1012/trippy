package pse.trippy.notificationservice.service;

import java.security.Security;
import java.util.List;

import org.bouncycastle.jce.provider.BouncyCastleProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import nl.martijndwars.webpush.Notification;
import nl.martijndwars.webpush.PushService;
import nl.martijndwars.webpush.Subscription;
import pse.trippy.notificationservice.model.WebPushSubscription;
import pse.trippy.notificationservice.repository.WebPushSubscriptionRepository;

@Service
@Slf4j
@RequiredArgsConstructor
public class WebPushService {

    @Value("${web-push.public-key}")
    private String publicKey;

    @Value("${web-push.private-key}")
    private String privateKey;

    @Value("${web-push.subject}")
    private String subject;

    @Value("${web-push.enabled:true}")
    private boolean enabled;

    private final WebPushSubscriptionRepository repository;
    private PushService pushService;

    @PostConstruct
    public void init() {
        if (!enabled) {
            log.info("Web Push is disabled by configuration");
            return;
        }
        try {
            if (Security.getProvider(BouncyCastleProvider.PROVIDER_NAME) == null) {
                Security.addProvider(new BouncyCastleProvider());
            }
            pushService = new PushService(publicKey, privateKey, subject);
        } catch (Exception e) {
            throw new IllegalStateException("Failed to initialize Web Push with the configured VAPID keys", e);
        }
    }

    public String getPublicKey() {
        return publicKey;
    }

    public void subscribe(String userId, String endpoint, String p256dh, String auth) {
        WebPushSubscription subscription = repository.findByEndpoint(endpoint)
                .map(existing -> {
                    existing.setUserId(userId);
                    existing.setP256dh(p256dh);
                    existing.setAuth(auth);
                    return existing;
                })
                .orElseGet(() -> WebPushSubscription.builder()
                        .userId(userId)
                        .endpoint(endpoint)
                        .p256dh(p256dh)
                        .auth(auth)
                        .build());
        repository.save(subscription);
    }

    public void unsubscribe(String userId, String endpoint) {
        repository.deleteByEndpointAndUserId(endpoint, userId);
    }

    public void sendPushNotification(String userId, String payload) {
        if (pushService == null) {
            log.warn("Web Push is unavailable; skipping notification for user {}", userId);
            return;
        }
        List<WebPushSubscription> subscriptions = repository.findAllByUserId(userId);
        
        for (WebPushSubscription sub : subscriptions) {
            try {
                Subscription.Keys keys = new Subscription.Keys(sub.getP256dh(), sub.getAuth());
                Subscription subscription = new Subscription(sub.getEndpoint(), keys);
                
                Notification notification = new Notification(subscription, payload);
                pushService.send(notification);
                log.info("Push notification sent to user {} via subscription {}", userId,
                        endpointFingerprint(sub.getEndpoint()));
            } catch (Exception e) {
                log.error("Failed to send push notification to subscription {}",
                        endpointFingerprint(sub.getEndpoint()), e);
                if (e.getMessage() != null && (e.getMessage().contains("410 Gone") || e.getMessage().contains("404 Not Found"))) {
                    log.info("Removing inactive subscription {}", endpointFingerprint(sub.getEndpoint()));
                    repository.deleteByEndpoint(sub.getEndpoint());
                }
            }
        }
    }

    private String endpointFingerprint(String endpoint) {
        return endpoint == null ? "unknown" : Integer.toHexString(endpoint.hashCode());
    }
}
