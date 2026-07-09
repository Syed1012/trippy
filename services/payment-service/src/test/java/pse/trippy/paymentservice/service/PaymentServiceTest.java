package pse.trippy.paymentservice.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.junit.jupiter.MockitoExtension;
import pse.trippy.paymentservice.dto.response.FeatureResponse;
import pse.trippy.paymentservice.dto.request.CheckoutRequest;
import pse.trippy.paymentservice.dto.response.CheckoutResponse;
import pse.trippy.paymentservice.dto.response.PlanResponse;
import pse.trippy.paymentservice.dto.response.TransactionResponse;
import pse.trippy.paymentservice.exception.InvalidPlanException;
import pse.trippy.paymentservice.model.entity.Transaction;
import pse.trippy.paymentservice.model.enums.PlanType;
import pse.trippy.paymentservice.model.enums.TransactionStatus;
import pse.trippy.paymentservice.model.enums.TransactionType;
import pse.trippy.paymentservice.repository.TransactionRepository;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import org.mockito.Mock;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@DisplayName("PaymentService")
class PaymentServiceTest {

    @Mock
    private TransactionRepository transactionRepository;

    @Mock
    private PaymentValidator paymentValidator;

    @InjectMocks
    private PaymentService paymentService;

    @Test
    @DisplayName("getAvailablePlans returns PREMIUM and ENTERPRISE")
    void getAvailablePlansReturnsBothPlans() {
        List<PlanResponse> plans = paymentService.getAvailablePlans();

        assertThat(plans).hasSize(2);
        PlanResponse premium = plans.get(0);
        assertThat(premium.id()).isEqualTo("premium");
        assertThat(premium.name()).isEqualTo("Premium");
        assertThat(premium.prices().get(0).amount()).isEqualByComparingTo(new BigDecimal("9.99"));
        assertThat(premium.prices().get(0).currency()).isEqualTo("EUR");
        assertThat(premium.features()).extracting(FeatureResponse::feature).contains("Unlimited trips", "AI itinerary generation");

        PlanResponse enterprise = plans.get(1);
        assertThat(enterprise.id()).isEqualTo("enterprise");
        assertThat(enterprise.name()).isEqualTo("Enterprise");
        assertThat(enterprise.prices().get(0).amount()).isEqualByComparingTo(new BigDecimal("29.99"));
    }

    @Test
    @DisplayName("checkout with PREMIUM plan records transaction and returns success")
    void checkoutPremiumSucceeds() {
        UUID userId = UUID.randomUUID();
        CheckoutRequest request = new CheckoutRequest("premium_monthly", UUID.randomUUID());

        CheckoutResponse response = paymentService.checkout(userId, request);

        assertThat(response.getTransactionId()).isNotNull();
        assertThat(response.getStatus()).isEqualTo("INITIATED");
        assertThat(response.getPlan()).isEqualTo("premium_monthly");
        assertThat(response.getAmount().getValue()).isEqualByComparingTo(new BigDecimal("9.99"));
        assertThat(response.getAmount().getCurrency()).isEqualTo("EUR");
        assertThat(response.getMessage()).isEqualTo("Checkout initiated. Proceed to confirmation.");
    }

    @Test
    @DisplayName("checkout with ENTERPRISE plan records correct amount")
    void checkoutEnterpriseSucceeds() {
        UUID userId = UUID.randomUUID();
        CheckoutRequest request = new CheckoutRequest("enterprise_monthly", UUID.randomUUID());

        CheckoutResponse response = paymentService.checkout(userId, request);

        assertThat(response.getPlan()).isEqualTo("enterprise_monthly");
        assertThat(response.getAmount().getValue()).isEqualByComparingTo(new BigDecimal("29.99"));
    }

    @Test
    @DisplayName("checkout with case-insensitive plan ID succeeds")
    void checkoutCaseInsensitive() {
        UUID userId = UUID.randomUUID();
        // Use an uppercase version of the plan ID to test case-insensitivity
        CheckoutRequest request = new CheckoutRequest("PREMIUM_MONTHLY", UUID.randomUUID());

        CheckoutResponse response = paymentService.checkout(userId, request); 

        assertThat(response.getPlan()).isEqualTo("premium_monthly"); // The service should normalize it
    }

    @Test
    @DisplayName("checkout with invalid planId throws InvalidPlanException")
    void checkoutInvalidPlanThrows() {
        UUID userId = UUID.randomUUID();
        CheckoutRequest request = new CheckoutRequest("INVALID_PLAN", UUID.randomUUID());

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
        assertThat(transactions.get(0).description()).isEqualTo("ENTERPRISE subscription");
        assertThat(transactions.get(0).type()).isEqualTo("SUBSCRIPTION");
        assertThat(transactions.get(1).transactionId()).isEqualTo(older.getId());
        assertThat(transactions.get(1).description()).isEqualTo("PREMIUM subscription");
        }
}
