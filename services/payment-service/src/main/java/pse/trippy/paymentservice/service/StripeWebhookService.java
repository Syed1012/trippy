package pse.trippy.paymentservice.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.stripe.exception.StripeException;
import com.stripe.model.Event;
import com.stripe.model.Invoice;
import com.stripe.model.Subscription;
import com.stripe.model.checkout.Session;
import com.stripe.param.checkout.SessionRetrieveParams;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import pse.trippy.paymentservice.model.entity.StripeCustomer;
import pse.trippy.paymentservice.model.enums.PlanType;
import pse.trippy.paymentservice.repository.StripeCustomerRepository;
import pse.trippy.paymentservice.model.entity.UserSubscription;
import pse.trippy.paymentservice.repository.SubscriptionRepository; 

import java.io.IOException;
import java.util.Optional;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class StripeWebhookService {

    private final PaymentService paymentService;
    private final SubscriptionService subscriptionService;
    private final StripeCustomerRepository stripeCustomerRepository;
    private final SubscriptionRepository subscriptionRepository;

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Value("${stripe.price.premium}")
    private String premiumPriceId;

    @Value("${stripe.price.enterprise}")
    private String enterprisePriceId;

    private String extractId(Event event) {
        try {
            JsonNode root = objectMapper.readTree(event.getData().getObject().toJson());
            return root.get("id").asText();
        } catch (IOException e) {
            throw new RuntimeException("Failed to parse Stripe event JSON", e);
        }
    }

    public void handleCheckoutCompleted(Event event) {
        String sessionId = extractId(event);

        Session fullSession;
        try {
            SessionRetrieveParams params = SessionRetrieveParams.builder()
                    .addExpand("line_items")
                    .build();

            fullSession = Session.retrieve(sessionId, params, null);
        } catch (StripeException e) {
            log.error("Failed to retrieve full checkout session {}", sessionId, e);
            return;
        }

        String customerId = fullSession.getCustomer();

        if (customerId == null || customerId.isBlank()) {
            log.error("Checkout session {} has no customer ID", sessionId);
            return;
        }

        String clientReferenceId = fullSession.getClientReferenceId();

        if (clientReferenceId == null || clientReferenceId.isBlank()) {
            log.error("No client_reference_id found for checkout session {}", sessionId);
            return;
        }

        UUID userId;
        try {
            userId = UUID.fromString(clientReferenceId);
        } catch (IllegalArgumentException e) {
            log.error("Invalid client_reference_id for checkout session {}: {}", sessionId, clientReferenceId);
            return;
        }

        if (fullSession.getLineItems() == null || fullSession.getLineItems().getData().isEmpty()) {
            log.error("No line items found for checkout session {}", sessionId);
            return;
        }

        Optional<StripeCustomer> existingCustomer =
                stripeCustomerRepository.findByStripeCustomerId(customerId);

        if (existingCustomer.isEmpty()) {
            StripeCustomer stripeCustomer = StripeCustomer.builder()
                    .userId(userId)
                    .stripeCustomerId(customerId)
                    .build();

            stripeCustomerRepository.save(stripeCustomer);

            log.info("Saved Stripe customer mapping. userId={}, customerId={}", userId, customerId);
        } else {
            userId = existingCustomer.get().getUserId();
        }

        String priceId = fullSession.getLineItems()
                .getData()
                .get(0)
                .getPrice()
                .getId();

        PlanType plan = mapPriceToPlan(priceId);

        subscriptionService.activateSubscription(userId, plan);
        log.info("Subscription activated for user {}", userId);
    }

    public void handleInvoicePaid(Event event) {
        String invoiceId = extractId(event);

        Invoice fullInvoice;
        try {
            fullInvoice = Invoice.retrieve(invoiceId);
        } catch (StripeException e) {
            log.error("Failed to retrieve full invoice {}", invoiceId, e);
            return;
        }

        Optional<UUID> userIdOptional = findUserId(fullInvoice.getCustomer());

        if (userIdOptional.isEmpty()) {
            log.warn("Ignoring invoice.paid for unknown Stripe customer {}", fullInvoice.getCustomer());
            return;
        }

        UUID userId = userIdOptional.get();
        double amount = fullInvoice.getAmountPaid() / 100.0;
        UserSubscription subscription = subscriptionRepository
                                    .findByUserId(userId)
                                    .orElseThrow(() -> new RuntimeException("No subscription found for user " + userId));

        PlanType planType = PlanType.valueOf(subscription.getPlan().name());

        paymentService.recordTransaction(userId, planType, amount, "Subscription payment");
        log.info("Invoice paid recorded for user {}", userId);
    }

    public void handleSubscriptionCreated(Event event) {
        String subId = extractId(event);

        Subscription fullSub;
        try {
            fullSub = Subscription.retrieve(subId);
        } catch (StripeException e) {
            log.error("Failed to retrieve full subscription {}", subId, e);
            return;
        }

        Optional<UUID> userIdOptional = findUserId(fullSub.getCustomer());

        if (userIdOptional.isEmpty()) {
            log.warn("Ignoring customer.subscription.created for unknown Stripe customer {}", fullSub.getCustomer());
            return;
        }

        UUID userId = userIdOptional.get();

        if (fullSub.getItems() == null || fullSub.getItems().getData().isEmpty()) {
            log.error("No subscription items found for subscription {}", fullSub.getId());
            return;
        }

        String priceId = fullSub.getItems()
                .getData()
                .get(0)
                .getPrice()
                .getId();

        PlanType plan = mapPriceToPlan(priceId);

        subscriptionService.activateSubscription(userId, plan);
        log.info("Subscription created for user {}", userId);
    }

    private Optional<UUID> findUserId(String stripeCustomerId) {
        return stripeCustomerRepository.findByStripeCustomerId(stripeCustomerId)
                .map(StripeCustomer::getUserId);
    }

    private PlanType mapPriceToPlan(String priceId) {
        if (priceId.equals(premiumPriceId)) {
            return PlanType.PREMIUM;
        }

        if (priceId.equals(enterprisePriceId)) {
            return PlanType.ENTERPRISE;
        }

        throw new RuntimeException("Unknown Stripe price ID: " + priceId);
    }
}