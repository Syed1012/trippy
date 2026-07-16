package pse.trippy.paymentservice.service;

import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pse.trippy.paymentservice.config.RabbitMQConfig;
import pse.trippy.paymentservice.dto.request.CancelSubscriptionRequest;
import pse.trippy.paymentservice.dto.request.PaymentConfirmationRequest;
import pse.trippy.paymentservice.dto.response.PaymentConfirmationResponse;
import pse.trippy.paymentservice.dto.response.SubscriptionResponse;
import pse.trippy.paymentservice.exception.InvalidPaymentException;
import pse.trippy.paymentservice.exception.SubscriptionNotFoundException;
import pse.trippy.paymentservice.model.entity.UserSubscription;
import pse.trippy.paymentservice.model.entity.Transaction;
import pse.trippy.paymentservice.model.enums.PlanType;
import pse.trippy.paymentservice.model.enums.SubscriptionPlan;
import pse.trippy.paymentservice.model.enums.SubscriptionStatus;
import pse.trippy.paymentservice.model.enums.TransactionStatus;
import pse.trippy.paymentservice.repository.SubscriptionRepository;
import pse.trippy.paymentservice.repository.TransactionRepository;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class SubscriptionService {

    private static final Logger log = LoggerFactory.getLogger(SubscriptionService.class);

    private final SubscriptionRepository subscriptionRepository;
    private final TransactionRepository transactionRepository;
    private final RabbitTemplate rabbitTemplate;

    private static final Map<String, BigDecimal> PLAN_PRICING = Map.of(
            "premium_monthly", new BigDecimal("9.99"),
            "premium_yearly", new BigDecimal("99.99"),
            "enterprise_monthly", new BigDecimal("29.99"),
            "enterprise_yearly", new BigDecimal("299.99")
    );

    @Transactional
    public PaymentConfirmationResponse confirmPayment(UUID userId, PaymentConfirmationRequest request) {
        BigDecimal price = PLAN_PRICING.get(request.planId());
        if (price == null) {
            throw new InvalidPaymentException("Unknown plan: " + request.planId());
        }

        SubscriptionPlan plan = resolvePlan(request.planId());
        boolean isYearly = request.planId().endsWith("_yearly");

        // Create transaction with PENDING status
        Transaction transaction = Transaction.builder()
                .userId(userId)
                .planId(PlanType.valueOf(plan.name()))
                .amount(price)
                .status(TransactionStatus.PENDING)
                .build();
        transaction = transactionRepository.save(transaction);

        // Dummy verification: always succeeds
        transaction.setStatus(TransactionStatus.COMPLETED);
        transaction = transactionRepository.save(transaction);

        // Create or update subscription
        LocalDate now = LocalDate.now();
        LocalDate periodEnd = isYearly ? now.plusYears(1) : now.plusMonths(1);

        UserSubscription subscription = subscriptionRepository.findByUserId(userId)
                .map(existing -> {
                    existing.setPlan(plan);
                    existing.setStatus(SubscriptionStatus.ACTIVE);
                    existing.setCurrentPeriodStart(now);
                    existing.setCurrentPeriodEnd(periodEnd);
                    existing.setCancelAtPeriodEnd(false);
                    existing.setPriceAmount(price);
                    return existing;
                })
                .orElseGet(() -> UserSubscription.builder()
                        .userId(userId)
                        .plan(plan)
                        .status(SubscriptionStatus.ACTIVE)
                        .currentPeriodStart(now)
                        .currentPeriodEnd(periodEnd)
                        .priceAmount(price)
                        .build());
        subscription = subscriptionRepository.save(subscription);

        log.info("Payment confirmed for user {} - plan: {}, transaction: {}",
                userId, request.planId(), transaction.getId());

        publishSubscriptionActivatedEvent(userId, subscription);

        return new PaymentConfirmationResponse(
                transaction.getId(),
                transaction.getStatus().name(),
                toSubscriptionResponse(subscription),
                "VRF-" + transaction.getId().toString().substring(0, 8).toUpperCase(),
                Instant.now()
        );
    }

    @Transactional(readOnly = true)
    public SubscriptionResponse getSubscription(UUID userId) {
        UserSubscription subscription = subscriptionRepository.findByUserId(userId)
                .orElseThrow(() -> new SubscriptionNotFoundException(
                        "No subscription found for user: " + userId));
        return toSubscriptionResponse(subscription);
    }

    @Transactional
    public SubscriptionResponse cancelSubscription(UUID userId, CancelSubscriptionRequest request) {
        UserSubscription subscription = subscriptionRepository.findByUserId(userId)
                .orElseThrow(() -> new SubscriptionNotFoundException(
                        "No subscription found for user: " + userId));

        if (request.cancelImmediately()) {
            subscription.setStatus(SubscriptionStatus.CANCELLED);
            subscription.setCancelAtPeriodEnd(false);
        } else {
            subscription.setCancelAtPeriodEnd(true);
        }
        subscription = subscriptionRepository.save(subscription);

        log.info("Subscription cancelled for user {} - immediate: {}", userId, request.cancelImmediately());

        return toSubscriptionResponse(subscription);
    }

    private SubscriptionPlan resolvePlan(String planId) {
        if (planId.startsWith("enterprise")) {
            return SubscriptionPlan.ENTERPRISE;
        }
        return SubscriptionPlan.PREMIUM;
    }

    private SubscriptionResponse toSubscriptionResponse(UserSubscription subscription) {
        return new SubscriptionResponse(
                subscription.getId(),
                subscription.getPlan().name(),
                subscription.getStatus().name(),
                subscription.getCurrentPeriodStart(),
                subscription.getCurrentPeriodEnd(),
                subscription.isCancelAtPeriodEnd(),
                subscription.getPriceAmount(),
                subscription.getCurrency()
        );
    }

    private void publishSubscriptionActivatedEvent(UUID userId, UserSubscription subscription) {
        try {
            Map<String, Object> event = Map.of(
                    "eventType", "payment.subscription.activated",
                    "userId", userId.toString(),
                    "plan", subscription.getPlan().name(),
                    "status", subscription.getStatus().name(),
                    "periodStart", subscription.getCurrentPeriodStart().toString(),
                    "periodEnd", subscription.getCurrentPeriodEnd().toString(),
                    "timestamp", Instant.now().toString()
            );
            rabbitTemplate.convertAndSend(
                    RabbitMQConfig.TRIPPY_EVENTS_EXCHANGE,
                    "payment.subscription.activated",
                    event);
            log.info("Published payment.subscription.activated event for user {}", userId);
        } catch (Exception e) {
            log.warn("Failed to publish subscription activated event for user {}: {}", userId, e.getMessage());
        }
    }

    @Transactional
    public UserSubscription activateSubscription(UUID userId, PlanType planType) {
        LocalDate now = LocalDate.now();
        LocalDate periodEnd = now.plusMonths(1);

        SubscriptionPlan subscriptionPlan = SubscriptionPlan.valueOf(planType.name());

        UserSubscription subscription = subscriptionRepository.findByUserId(userId)
                .map(existing -> {
                    existing.setPlan(subscriptionPlan);
                    existing.setStatus(SubscriptionStatus.ACTIVE);
                    existing.setCurrentPeriodStart(now);
                    existing.setCurrentPeriodEnd(periodEnd);
                    existing.setCancelAtPeriodEnd(false);
                    existing.setPriceAmount(planType.getPrice());
                    existing.setCurrency(planType.getCurrency());
                    return existing;
                })
                .orElseGet(() -> UserSubscription.builder()
                        .userId(userId)
                        .plan(subscriptionPlan)
                        .status(SubscriptionStatus.ACTIVE)
                        .currentPeriodStart(now)
                        .currentPeriodEnd(periodEnd)
                        .priceAmount(planType.getPrice())
                        .currency(planType.getCurrency())
                        .build());

        subscription = subscriptionRepository.save(subscription);

        publishSubscriptionActivatedEvent(userId, subscription);

        return subscription;
    }

}
