package pse.trippy.paymentservice.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import pse.trippy.paymentservice.config.RabbitMQConfig;
import pse.trippy.paymentservice.dto.request.CheckoutRequest;
import pse.trippy.paymentservice.dto.response.CheckoutResponse;
import pse.trippy.paymentservice.dto.response.PlanResponse;
import pse.trippy.paymentservice.dto.response.TransactionResponse;
import pse.trippy.paymentservice.exception.InvalidPlanException;
import pse.trippy.paymentservice.model.entity.Subscription;
import pse.trippy.paymentservice.model.entity.Transaction;
import pse.trippy.paymentservice.model.enums.PlanType;
import pse.trippy.paymentservice.model.enums.SubscriptionPlan;
import pse.trippy.paymentservice.model.enums.SubscriptionStatus;
import pse.trippy.paymentservice.model.enums.TransactionStatus;
import pse.trippy.paymentservice.model.enums.TransactionType;
import pse.trippy.paymentservice.repository.SubscriptionRepository;
import pse.trippy.paymentservice.repository.TransactionRepository;

import java.util.Arrays;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class PaymentService {

    private final TransactionRepository transactionRepository;
    private final SubscriptionRepository subscriptionRepository;
    private final RabbitTemplate rabbitTemplate;
    private final PaymentValidator paymentValidator;

    public List<PlanResponse> getAvailablePlans() {
        return Arrays.stream(PlanType.values())
                .map(plan -> PlanResponse.builder()
                        .planId(plan.name())
                        .displayName(plan.getDisplayName())
                        .price(plan.getPrice())
                        .currency(plan.getCurrency())
                        .features(plan.getFeatures())
                        .build())
                .toList();
    }

    @Transactional
    public CheckoutResponse checkout(UUID userId, CheckoutRequest request) {
        PlanType plan = parsePlan(request.getPlanId());
        paymentValidator.validateCheckoutPaymentMethod(userId, request.getPaymentMethodId());

        log.info("Processing checkout for user {} on plan {} with paymentMethod {}",
                userId, plan.name(), request.getPaymentMethodId());

        Transaction transaction = transactionRepository.save(Transaction.builder()
                .userId(userId)
                .planId(plan)
                .amount(plan.getPrice())
                .currency(plan.getCurrency())
                .status(TransactionStatus.COMPLETED)
                .type(TransactionType.SUBSCRIPTION)
                .description(plan.getDisplayName() + " subscription checkout")
                .build());

        Subscription subscription = activateSubscription(userId, plan);
        publishSubscriptionActivatedEventAfterCommit(userId, subscription);

        log.info("Transaction {} completed for user {}", transaction.getId(), userId);

        return CheckoutResponse.builder()
                .transactionId(transaction.getId())
                .status(transaction.getStatus().name())
                .plan(plan.name())
                .amount(CheckoutResponse.Amount.builder()
                        .value(plan.getPrice())
                        .currency(plan.getCurrency())
                        .build())
                .message("Subscription activated successfully")
                .build();
    }

    private PlanType parsePlan(String planId) {
        try {
            String normalized = planId.trim().toUpperCase(Locale.ROOT);
            if (normalized.endsWith("_YEARLY")) {
                throw new InvalidPlanException(planId);
            }
            if (normalized.endsWith("_MONTHLY")) {
                normalized = normalized.substring(0, normalized.indexOf('_'));
            }
            return PlanType.valueOf(normalized);
        } catch (IllegalArgumentException e) {
            throw new InvalidPlanException(planId);
        }
    }

    @Transactional(readOnly = true)
    public List<TransactionResponse> getTransactions(UUID userId) {
        return transactionRepository.findByUserIdOrderByCreatedAtDesc(userId)
                .stream()
                .map(t -> new TransactionResponse(
                        t.getId(),
                        t.getUserId(),
                        t.getAmount(),
                        t.getCurrency(),
                        t.getType() != null ? t.getType().name() : TransactionType.SUBSCRIPTION.name(),
                        t.getStatus().name(),
                        t.getPlanId().getDisplayName() + " subscription",
                        t.getCreatedAt()
                ))
                .toList();
    }
    
    private Subscription activateSubscription(UUID userId, PlanType plan) {
        LocalDate now = LocalDate.now();
        LocalDate periodEnd = now.plusMonths(1);
        SubscriptionPlan subscriptionPlan = SubscriptionPlan.valueOf(plan.name());

        return subscriptionRepository.findByUserId(userId)
                .map(existing -> {
                    existing.setPlan(subscriptionPlan);
                    existing.setStatus(SubscriptionStatus.ACTIVE);
                    existing.setCurrentPeriodStart(now);
                    existing.setCurrentPeriodEnd(periodEnd);
                    existing.setCancelAtPeriodEnd(false);
                    existing.setPriceAmount(plan.getPrice());
                    existing.setCurrency(plan.getCurrency());
                    return subscriptionRepository.save(existing);
                })
                .orElseGet(() -> subscriptionRepository.save(Subscription.builder()
                        .userId(userId)
                        .plan(subscriptionPlan)
                        .status(SubscriptionStatus.ACTIVE)
                        .currentPeriodStart(now)
                        .currentPeriodEnd(periodEnd)
                        .priceAmount(plan.getPrice())
                        .currency(plan.getCurrency())
                        .build()));
    }

    private void publishSubscriptionActivatedEvent(UUID userId, Subscription subscription) {
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
        } catch (Exception e) {
            log.warn("Failed to publish subscription activation for user {}", userId, e);
        }
    }

    private void publishSubscriptionActivatedEventAfterCommit(UUID userId, Subscription subscription) {
        if (!TransactionSynchronizationManager.isSynchronizationActive()) {
            publishSubscriptionActivatedEvent(userId, subscription);
            return;
        }

        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                publishSubscriptionActivatedEvent(userId, subscription);
            }
        });
    }
}
