package pse.trippy.notificationservice.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase.Replace;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.util.ReflectionTestUtils;
import pse.trippy.notificationservice.model.WebPushSubscription;
import pse.trippy.notificationservice.repository.WebPushSubscriptionRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;

@DataJpaTest
@AutoConfigureTestDatabase(replace = Replace.NONE)
@ActiveProfiles("test")
@Import(WebPushService.class)
@TestPropertySource(properties = {
    "web-push.enabled=false",
    "web-push.public-key=dummy-public-key",
    "web-push.private-key=dummy-private-key",
    "web-push.subject=mailto:dummy@example.com"
})
@DisplayName("WebPushService")
class WebPushServiceTest {

    @Autowired
    private WebPushService webPushService;

    @Autowired
    private WebPushSubscriptionRepository subscriptionRepository;

    private static final UUID USER_ID = UUID.randomUUID();
    private static final String ENDPOINT = "https://fcm.googleapis.com/fcm/send/some-endpoint";
    private static final String P256DH = "p256dh-key";
    private static final String AUTH = "auth-key";

    @BeforeEach
    void setUp() {
        subscriptionRepository.deleteAll();
    }

    @Test
    @DisplayName("getPublicKey returns the configured VAPID public key")
    void getPublicKeyReturnsCorrectKey() {
        String publicKey = webPushService.getPublicKey();
        assertThat(publicKey).isEqualTo("dummy-public-key");
    }

    @Test
    @DisplayName("subscribe saves the web push subscription for a user")
    void subscribeSavesSubscription() {
        webPushService.subscribe(USER_ID.toString(), ENDPOINT, P256DH, AUTH);

        Optional<WebPushSubscription> subscriptionOpt = subscriptionRepository.findByEndpoint(ENDPOINT);
        assertThat(subscriptionOpt).isPresent();
        
        WebPushSubscription subscription = subscriptionOpt.get();
        assertThat(subscription.getUserId()).isEqualTo(USER_ID.toString());
        assertThat(subscription.getP256dh()).isEqualTo(P256DH);
        assertThat(subscription.getAuth()).isEqualTo(AUTH);
    }

    @Test
    @DisplayName("subscribing the same endpoint refreshes it instead of creating a duplicate")
    void subscribeRefreshesExistingEndpoint() {
        webPushService.subscribe(USER_ID.toString(), ENDPOINT, P256DH, AUTH);
        String refreshedUserId = UUID.randomUUID().toString();
        webPushService.subscribe(refreshedUserId, ENDPOINT, "new-p256dh", "new-auth");

        assertThat(subscriptionRepository.count()).isOne();
        WebPushSubscription subscription = subscriptionRepository.findByEndpoint(ENDPOINT).orElseThrow();
        assertThat(subscription.getUserId()).isEqualTo(refreshedUserId);
        assertThat(subscription.getP256dh()).isEqualTo("new-p256dh");
        assertThat(subscription.getAuth()).isEqualTo("new-auth");
    }

    @Test
    @DisplayName("unsubscribe only deletes the authenticated user's subscription")
    void unsubscribeDeletesOnlyMatchingUserSubscription() {
        webPushService.subscribe(USER_ID.toString(), ENDPOINT, P256DH, AUTH);

        webPushService.unsubscribe(UUID.randomUUID().toString(), ENDPOINT);
        assertThat(subscriptionRepository.findByEndpoint(ENDPOINT)).isPresent();

        webPushService.unsubscribe(USER_ID.toString(), ENDPOINT);
        assertThat(subscriptionRepository.findByEndpoint(ENDPOINT)).isEmpty();
    }

    @Test
    @DisplayName("enabled Web Push rejects malformed VAPID keys")
    void enabledWebPushRejectsMalformedVapidKeys() {
        WebPushService service = new WebPushService(mock(WebPushSubscriptionRepository.class));
        ReflectionTestUtils.setField(service, "enabled", true);
        ReflectionTestUtils.setField(service, "publicKey", "invalid-public-key");
        ReflectionTestUtils.setField(service, "privateKey", "invalid-private-key");
        ReflectionTestUtils.setField(service, "subject", "mailto:test@example.com");

        assertThatThrownBy(service::init)
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("configured VAPID keys");
    }

    @Test
    @DisplayName("sendPushNotification does not throw when exception has null message")
    void sendPushNotificationHandlesNullExceptionMessage() throws Exception {
        WebPushSubscriptionRepository mockRepo = mock(WebPushSubscriptionRepository.class);
        WebPushService service = new WebPushService(mockRepo);
        ReflectionTestUtils.setField(service, "enabled", false);
        ReflectionTestUtils.setField(service, "publicKey", "dummy");
        ReflectionTestUtils.setField(service, "privateKey", "dummy");
        ReflectionTestUtils.setField(service, "subject", "mailto:test@example.com");

        nl.martijndwars.webpush.PushService mockPush = mock(nl.martijndwars.webpush.PushService.class);
        ReflectionTestUtils.setField(service, "pushService", mockPush);

        WebPushSubscription sub = WebPushSubscription.builder()
                .userId("user-1")
                .endpoint("https://push.example.com/sub1")
                .p256dh("key1")
                .auth("auth1")
                .build();

        org.mockito.Mockito.when(mockRepo.findAllByUserId("user-1"))
                .thenReturn(List.of(sub));

        org.mockito.Mockito.doThrow(new NullPointerException())
                .when(mockPush).send(org.mockito.ArgumentMatchers.any(nl.martijndwars.webpush.Notification.class));

        // Should NOT throw — the null-safe handling should catch the NPE gracefully
        org.junit.jupiter.api.Assertions.assertDoesNotThrow(
                () -> service.sendPushNotification("user-1", "{\"title\":\"test\"}"));

        // Subscription should NOT be deleted (NPE is not a 410/404)
        org.mockito.Mockito.verify(mockRepo, org.mockito.Mockito.never()).deleteByEndpoint(org.mockito.ArgumentMatchers.any());
    }

    @Test
    @DisplayName("sendPushNotification removes subscription when cause chain contains 410 Gone")
    void sendPushNotificationRemovesSubscriptionOn410InCauseChain() throws Exception {
        WebPushSubscriptionRepository mockRepo = mock(WebPushSubscriptionRepository.class);
        WebPushService service = new WebPushService(mockRepo);
        ReflectionTestUtils.setField(service, "enabled", false);
        ReflectionTestUtils.setField(service, "publicKey", "dummy");
        ReflectionTestUtils.setField(service, "privateKey", "dummy");
        ReflectionTestUtils.setField(service, "subject", "mailto:test@example.com");

        nl.martijndwars.webpush.PushService mockPush = mock(nl.martijndwars.webpush.PushService.class);
        ReflectionTestUtils.setField(service, "pushService", mockPush);

        String endpoint = "https://push.example.com/expired";
        WebPushSubscription sub = WebPushSubscription.builder()
                .userId("user-2")
                .endpoint(endpoint)
                .p256dh("key2")
                .auth("auth2")
                .build();

        org.mockito.Mockito.when(mockRepo.findAllByUserId("user-2"))
                .thenReturn(List.of(sub));

        // Wrap the 410 in a cause chain: RuntimeException -> IOException("410 Gone")
        Exception cause = new java.io.IOException("410 Gone");
        Exception wrapper = new RuntimeException("Push failed", cause);

        org.mockito.Mockito.doThrow(wrapper)
                .when(mockPush).send(org.mockito.ArgumentMatchers.any(nl.martijndwars.webpush.Notification.class));

        service.sendPushNotification("user-2", "{\"title\":\"test\"}");

        // Subscription should be cleaned up because cause contains "410 Gone"
        org.mockito.Mockito.verify(mockRepo).deleteByEndpoint(endpoint);
    }

    @Test
    @DisplayName("sendPushNotification does NOT delete subscription for unrelated error containing '404' substring")
    void sendPushNotificationDoesNotFalsePositiveOnSubstring() throws Exception {
        WebPushSubscriptionRepository mockRepo = mock(WebPushSubscriptionRepository.class);
        WebPushService service = new WebPushService(mockRepo);
        ReflectionTestUtils.setField(service, "enabled", false);
        ReflectionTestUtils.setField(service, "publicKey", "dummy");
        ReflectionTestUtils.setField(service, "privateKey", "dummy");
        ReflectionTestUtils.setField(service, "subject", "mailto:test@example.com");

        nl.martijndwars.webpush.PushService mockPush = mock(nl.martijndwars.webpush.PushService.class);
        ReflectionTestUtils.setField(service, "pushService", mockPush);

        WebPushSubscription sub = WebPushSubscription.builder()
                .userId("user-3")
                .endpoint("https://push.example.com/active")
                .p256dh("key3")
                .auth("auth3")
                .build();

        org.mockito.Mockito.when(mockRepo.findAllByUserId("user-3"))
                .thenReturn(List.of(sub));

        // This message contains "404" as a substring but is NOT a 404 Not Found
        org.mockito.Mockito.doThrow(new RuntimeException("Timeout after 40400ms"))
                .when(mockPush).send(org.mockito.ArgumentMatchers.any(nl.martijndwars.webpush.Notification.class));

        service.sendPushNotification("user-3", "{\"title\":\"test\"}");

        // Should NOT delete — "40400" contains "404" but is not "404 Not Found"
        org.mockito.Mockito.verify(mockRepo, org.mockito.Mockito.never()).deleteByEndpoint(org.mockito.ArgumentMatchers.any());
    }
}
