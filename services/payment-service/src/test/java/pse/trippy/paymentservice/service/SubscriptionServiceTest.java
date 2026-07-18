package pse.trippy.paymentservice.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
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
import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@DisplayName("SubscriptionService")
class SubscriptionServiceTest {

    @Mock
    private SubscriptionRepository subscriptionRepository;
    @Mock
    private TransactionRepository transactionRepository;
    @Mock
    private RabbitTemplate rabbitTemplate;

    @InjectMocks
    private SubscriptionService subscriptionService;

    private static final UUID USER_ID = UUID.randomUUID();
    private static final UUID PAYMENT_METHOD_ID = UUID.randomUUID();

    private Transaction savedTransaction() {
        Transaction t = Transaction.builder()
                .userId(USER_ID)
                .planId(PlanType.PREMIUM)
                .amount(new BigDecimal("9.99"))
                .status(TransactionStatus.COMPLETED)
                .build();
        t.setId(UUID.randomUUID());
        return t;
    }

    private UserSubscription existingSubscription() {
        UserSubscription s = UserSubscription.builder()
                .userId(USER_ID)
                .plan(SubscriptionPlan.PREMIUM)
                .status(SubscriptionStatus.ACTIVE)
                .currentPeriodStart(LocalDate.now())
                .currentPeriodEnd(LocalDate.now().plusMonths(1))
                .priceAmount(new BigDecimal("9.99"))
                .build();
        s.setId(UUID.randomUUID());
        return s;
    }

    // =========================================================================
    // confirmPayment
    // =========================================================================

    @Nested
    @DisplayName("confirmPayment")
    class ConfirmPayment {

        @Test
        @DisplayName("creates new subscription for premium monthly plan")
        void createsNewSubscriptionForPremiumMonthly() {
            PaymentConfirmationRequest request = new PaymentConfirmationRequest(
                    "premium_monthly", PAYMENT_METHOD_ID, null);

            Transaction transaction = savedTransaction();
            when(transactionRepository.save(any(Transaction.class))).thenReturn(transaction);
            when(subscriptionRepository.findByUserId(USER_ID)).thenReturn(Optional.empty());
            when(subscriptionRepository.save(any(UserSubscription.class))).thenAnswer(invocation -> {
                UserSubscription s = invocation.getArgument(0);
                s.setId(UUID.randomUUID());
                return s;
            });

            PaymentConfirmationResponse response = subscriptionService.confirmPayment(USER_ID, request);

            assertThat(response.transactionId()).isEqualTo(transaction.getId());
            assertThat(response.status()).isEqualTo("COMPLETED");
            assertThat(response.subscription()).isNotNull();
            assertThat(response.subscription().plan()).isEqualTo("PREMIUM");
            assertThat(response.subscription().status()).isEqualTo("ACTIVE");
            assertThat(response.subscription().priceAmount()).isEqualByComparingTo(new BigDecimal("9.99"));
            assertThat(response.verificationReference()).startsWith("VRF-");
            assertThat(response.confirmedAt()).isNotNull();
        }

        @Test
        @DisplayName("updates existing subscription when user already has one")
        void updatesExistingSubscription() {
            PaymentConfirmationRequest request = new PaymentConfirmationRequest(
                    "enterprise_yearly", PAYMENT_METHOD_ID, null);

            Transaction transaction = savedTransaction();
            transaction.setAmount(new BigDecimal("299.99"));
            when(transactionRepository.save(any(Transaction.class))).thenReturn(transaction);

            UserSubscription existing = existingSubscription();
            when(subscriptionRepository.findByUserId(USER_ID)).thenReturn(Optional.of(existing));
            when(subscriptionRepository.save(any(UserSubscription.class))).thenAnswer(i -> i.getArgument(0));

            PaymentConfirmationResponse response = subscriptionService.confirmPayment(USER_ID, request);

            assertThat(response.subscription().plan()).isEqualTo("ENTERPRISE");
            assertThat(response.subscription().priceAmount()).isEqualByComparingTo(new BigDecimal("299.99"));
            verify(subscriptionRepository).save(any(UserSubscription.class));
        }

        @Test
        @DisplayName("throws InvalidPaymentException for unknown plan")
        void throwsForUnknownPlan() {
            PaymentConfirmationRequest request = new PaymentConfirmationRequest(
                    "unknown_plan", PAYMENT_METHOD_ID, null);

            assertThatThrownBy(() -> subscriptionService.confirmPayment(USER_ID, request))
                    .isInstanceOf(InvalidPaymentException.class)
                    .hasMessageContaining("Unknown plan");
        }
    }

    // =========================================================================
    // getSubscription
    // =========================================================================

    @Nested
    @DisplayName("getSubscription")
    class GetSubscription {

        @Test
        @DisplayName("returns subscription for existing user")
        void returnsSubscription() {
            UserSubscription subscription = existingSubscription();
            when(subscriptionRepository.findByUserId(USER_ID)).thenReturn(Optional.of(subscription));

            SubscriptionResponse response = subscriptionService.getSubscription(USER_ID);

            assertThat(response.subscriptionId()).isEqualTo(subscription.getId());
            assertThat(response.plan()).isEqualTo("PREMIUM");
            assertThat(response.status()).isEqualTo("ACTIVE");
            assertThat(response.currency()).isEqualTo("EUR");
        }

        @Test
        @DisplayName("throws SubscriptionNotFoundException for user without subscription")
        void throwsForMissingSubscription() {
            when(subscriptionRepository.findByUserId(USER_ID)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> subscriptionService.getSubscription(USER_ID))
                    .isInstanceOf(SubscriptionNotFoundException.class)
                    .hasMessageContaining(USER_ID.toString());
        }
    }

    // =========================================================================
    // cancelSubscription
    // =========================================================================

    @Nested
    @DisplayName("cancelSubscription")
    class CancelSubscription {

        @Test
        @DisplayName("cancels immediately when requested")
        void cancelsImmediately() {
            UserSubscription subscription = existingSubscription();
            when(subscriptionRepository.findByUserId(USER_ID)).thenReturn(Optional.of(subscription));
            when(subscriptionRepository.save(any(UserSubscription.class))).thenAnswer(i -> i.getArgument(0));

            CancelSubscriptionRequest request = new CancelSubscriptionRequest(true);
            SubscriptionResponse response = subscriptionService.cancelSubscription(USER_ID, request);

            assertThat(response.status()).isEqualTo("CANCELLED");
            assertThat(response.cancelAtPeriodEnd()).isFalse();
        }

        @Test
        @DisplayName("sets cancelAtPeriodEnd when not immediate")
        void cancelAtPeriodEnd() {
            UserSubscription subscription = existingSubscription();
            when(subscriptionRepository.findByUserId(USER_ID)).thenReturn(Optional.of(subscription));
            when(subscriptionRepository.save(any(UserSubscription.class))).thenAnswer(i -> i.getArgument(0));

            CancelSubscriptionRequest request = new CancelSubscriptionRequest(false);
            SubscriptionResponse response = subscriptionService.cancelSubscription(USER_ID, request);

            assertThat(response.status()).isEqualTo("ACTIVE");
            assertThat(response.cancelAtPeriodEnd()).isTrue();
        }

        @Test
        @DisplayName("throws SubscriptionNotFoundException for user without subscription")
        void throwsForMissingSubscription() {
            when(subscriptionRepository.findByUserId(USER_ID)).thenReturn(Optional.empty());

            SubscriptionResponse response = subscriptionService.getSubscription(USER_ID);

            assertThat(response.plan()).isEqualTo("FREE");
            assertThat(response.status()).isEqualTo("ACTIVE");
            assertThat(response.subscriptionId()).isNull();
        }
    }
}
