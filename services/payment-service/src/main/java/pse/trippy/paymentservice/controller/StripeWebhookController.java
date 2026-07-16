package pse.trippy.paymentservice.controller;

import com.stripe.model.Event;
import com.stripe.net.Webhook;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import pse.trippy.paymentservice.service.StripeWebhookService;

@Slf4j
@RestController
@RequestMapping("/payments/webhook")
@RequiredArgsConstructor
public class StripeWebhookController {

    private final StripeWebhookService webhookService;

    @PostMapping
    public ResponseEntity<String> handleStripeWebhook(
            @RequestBody String payload,
            @RequestHeader("Stripe-Signature") String sigHeader) {

        try {
            Event event = Webhook.constructEvent(
                    payload,
                    sigHeader,
                    "whsec_c350d06c1820e8da40991c5c282388e95c9d17d69c76df7052fe43004c7a15c9"
            );

            log.info("Webhook received event: {}", event.getType());

            switch (event.getType()) {
                case "checkout.session.completed" ->
                        webhookService.handleCheckoutCompleted(event);

                case "invoice.paid" ->
                        webhookService.handleInvoicePaid(event);

                case "customer.subscription.created" ->
                        webhookService.handleSubscriptionCreated(event);
            }

            return ResponseEntity.ok("success");

        } catch (Exception e) {
            log.error("Webhook error", e);
            return ResponseEntity.badRequest().body("invalid");
        }
    }
}