package pse.trippy.paymentservice.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import pse.trippy.paymentservice.exception.InvalidPaymentException;
import pse.trippy.paymentservice.exception.InvalidPaymentTokenException;
import pse.trippy.paymentservice.model.entity.PaymentMethod;
import pse.trippy.paymentservice.repository.PaymentMethodRepository;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@DisplayName("PaymentValidator")
class PaymentValidatorTest {

    @Mock
    private PaymentMethodRepository paymentMethodRepository;

    @InjectMocks
    private PaymentValidator paymentValidator;

    @Test
    @DisplayName("accepts valid checkout payment tokens")
    void acceptsValidCheckoutPaymentTokens() {
        assertThatCode(() -> paymentValidator.validateCheckoutPaymentMethod("pm_test_123"))
                .doesNotThrowAnyException();

        assertThatCode(() -> paymentValidator.validateCheckoutPaymentMethod("tok_live_123"))
                .doesNotThrowAnyException();
    }

    @Test
    @DisplayName("rejects malformed checkout payment tokens")
    void rejectsMalformedCheckoutPaymentTokens() {
        assertThatThrownBy(() -> paymentValidator.validateCheckoutPaymentMethod("bad-token"))
                .isInstanceOf(InvalidPaymentTokenException.class)
                .hasMessageContaining("Invalid payment method token");
    }

    @Test
    @DisplayName("accepts stored payment methods owned by the user")
    void acceptsStoredPaymentMethodsOwnedByUser() {
        UUID userId = UUID.randomUUID();
        UUID paymentMethodId = UUID.randomUUID();

        PaymentMethod paymentMethod = PaymentMethod.builder()
                .id(paymentMethodId)
                .userId(userId)
                .type("card")
                .last4("4242")
                .brand("VISA")
                .expiryMonth(12)
                .expiryYear(2030)
                .build();

        when(paymentMethodRepository.findById(paymentMethodId)).thenReturn(Optional.of(paymentMethod));

        assertThatCode(() -> paymentValidator.validateStoredPaymentMethod(userId, paymentMethodId))
                .doesNotThrowAnyException();
    }

    @Test
    @DisplayName("rejects missing stored payment methods")
    void rejectsMissingStoredPaymentMethods() {
        UUID userId = UUID.randomUUID();
        UUID paymentMethodId = UUID.randomUUID();

        when(paymentMethodRepository.findById(paymentMethodId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> paymentValidator.validateStoredPaymentMethod(userId, paymentMethodId))
                .isInstanceOf(InvalidPaymentException.class)
                .hasMessageContaining(paymentMethodId.toString());
    }
}