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
import pse.trippy.notificationservice.model.WebPushSubscription;
import pse.trippy.notificationservice.repository.WebPushSubscriptionRepository;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

@DataJpaTest
@AutoConfigureTestDatabase(replace = Replace.NONE)
@ActiveProfiles("test")
@Import(WebPushService.class)
@TestPropertySource(properties = {
    "web-push.public-key=BJYksTzUnIKhjoNUcwx5Z6Bc9yneCFAKEHlwgLzVwhvQYXAxBg45S-6hiAY0LTF22fPA31zNzIOubD9opAKcYLk",
    "web-push.private-key=5uNGLCXdpDPHeBNq-ij9-tNoD37D8J7d7QPzDQT_Mc4",
    "web-push.subject=mailto:admin@trippy.com"
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
        assertThat(publicKey).isEqualTo("BJYksTzUnIKhjoNUcwx5Z6Bc9yneCFAKEHlwgLzVwhvQYXAxBg45S-6hiAY0LTF22fPA31zNzIOubD9opAKcYLk");
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
    @DisplayName("unsubscribe deletes the subscription by endpoint")
    void unsubscribeDeletesSubscription() {
        webPushService.subscribe(USER_ID.toString(), ENDPOINT, P256DH, AUTH);
        assertThat(subscriptionRepository.findByEndpoint(ENDPOINT)).isPresent();

        webPushService.unsubscribe(ENDPOINT);
        assertThat(subscriptionRepository.findByEndpoint(ENDPOINT)).isEmpty();
    }
}
