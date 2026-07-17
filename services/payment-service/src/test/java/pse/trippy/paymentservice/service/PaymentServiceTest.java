package pse.trippy.paymentservice.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import pse.trippy.paymentservice.dto.request.CheckoutRequest;
import pse.trippy.paymentservice.dto.response.CheckoutResponse;
import pse.trippy.paymentservice.dto.response.PlanResponse;
import pse.trippy.paymentservice.dto.response.TransactionResponse;
import pse.trippy.paymentservice.exception.InvalidPlanException;
import pse.trippy.paymentservice.model.entity.Transaction;
import pse.trippy.paymentservice.model.enums.PlanType;
import pse.trippy.paymentservice.model.enums.TransactionStatus;
import pse.trippy.paymentservice.model.enums.TransactionType;
import pse.trippy.paymentservice.repository.SubscriptionRepository;
import pse.trippy.paymentservice.repository.TransactionRepository;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@DisplayName("PaymentService")
class PaymentServiceTest {

    @Mock
    private TransactionRepository transactionRepository;

    @Mock
    private SubscriptionRepository subscriptionRepository;

    @Mock
    private PaymentValidator paymentValidator;

    @InjectMocks
    private PaymentService paymentService;

    @Test
    @DisplayName("getAvailablePlans returns PREMIUM and ENTERPRISE")
    void getAvailablePlansReturnsBothPlans() {
        List<PlanResponse> plans = paymentService.getAvailablePlans();

        assertThat(plans).hasSize(2);
        assertThat(plans.get(0).getPlanId()).isEqualTo("PREMIUM");
        assertThat(plans.get(0).getPrice()).isEqualByComparingTo(new BigDecimal("9.99"));
        assertThat(plans.get(0).getCurrency()).isEqualTo("EUR");
        assertThat(plans.get(1).getPlanId()).isEqualTo("ENTERPRISE");
        assertThat(plans.get(1).getPrice()).isEqualByComparingTo(new BigDecimal("29.99"));
    }

    @Test
    @DisplayName("checkout returns Stripe payment link for PREMIUM")
    void checkoutReturnsStripeLinkPremium() {
        UUID userId = UUID.randomUUID();
        CheckoutRequest request = CheckoutRequest.builder()
                .planId("PREMIUM")
                .build();

        CheckoutResponse response = paymentService.checkout(userId, request);

        assertThat(response.getUrl()).startsWith("https://buy.stripe.com/");
    }

    @Test
    @DisplayName("checkout returns Stripe payment link for ENTERPRISE")
    void checkoutReturnsStripeLinkEnterprise() {
        UUID userId = UUID.randomUUID();
        CheckoutRequest request = CheckoutRequest.builder()
                .planId("ENTERPRISE")
                .build();

        CheckoutResponse response = paymentService.checkout(userId, request);

        assertThat(response.getUrl()).startsWith("https://buy.stripe.com/");
    }

    @Test
    @DisplayName("checkout with invalid planId throws InvalidPlanException")
    void checkoutInvalidPlanThrows() {
        UUID userId = UUID.randomUUID();
        CheckoutRequest request = CheckoutRequest.builder()
                .planId("INVALID_PLAN")
                .build();

        assertThatThrownBy(() -> paymentService.checkout(userId, request))
                .isInstanceOf(InvalidPlanException.class)
                .hasMessageContaining("INVALID_PLAN");
    }

    @Test
    @DisplayName("getTransactions returns newest transactions first and maps billing fields")
    void getTransactionsReturnsNewestFirst() {
        UUID userId = UUID.randomUUID();
        Transaction older = Transaction.builder()
                .id(UUID.randomUUID())
                .userId(userId)
                .planId(PlanType.PREMIUM)
                .amount(new BigDecimal("9.99"))
                .currency("EUR")
                .status(TransactionStatus.COMPLETED)
                .type(TransactionType.SUBSCRIPTION)
                .build();
        older.setCreatedAt(Instant.parse("2026-05-21T10:00:00Z"));

        Transaction newer = Transaction.builder()
                .id(UUID.randomUUID())
                .userId(userId)
                .planId(PlanType.ENTERPRISE)
                .amount(new BigDecimal("29.99"))
                .currency("EUR")
                .status(TransactionStatus.COMPLETED)
                .type(TransactionType.SUBSCRIPTION)
                .build();
        newer.setCreatedAt(Instant.parse("2026-05-22T10:00:00Z"));

        when(transactionRepository.findByUserIdOrderByCreatedAtDesc(userId))
                .thenReturn(List.of(newer, older));

        List<TransactionResponse> transactions = paymentService.getTransactions(userId);

        assertThat(transactions).hasSize(2);
        assertThat(transactions.get(0).transactionId()).isEqualTo(newer.getId());
        assertThat(transactions.get(0).description()).isEqualTo("Enterprise Plan subscription");
        assertThat(transactions.get(0).type()).isEqualTo("SUBSCRIPTION");
        assertThat(transactions.get(1).transactionId()).isEqualTo(older.getId());
        assertThat(transactions.get(1).description()).isEqualTo("Premium Plan subscription");
    }
}
