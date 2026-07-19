package pse.trippy.paymentservice.config;

import com.stripe.Stripe;
import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;

@Configuration
public class StripeConfig {

    @Value("${stripe.webhook.secret}")
    private String webhookSecret;

    @Value("${stripe.secret.key}")
    private String secretKey;

    @PostConstruct
    public void init() {
        Stripe.apiKey = secretKey;
    }

    public String getWebhookSecret() {
        return webhookSecret;
    }

    public String getSecretKey() {
        return secretKey;
    }
}