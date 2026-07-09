package pse.trippy.paymentservice.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import pse.trippy.paymentservice.exception.InvalidPaymentException;
import pse.trippy.paymentservice.exception.InvalidPaymentTokenException;
import pse.trippy.paymentservice.model.entity.PaymentMethod;
import pse.trippy.paymentservice.repository.PaymentMethodRepository;

import java.util.UUID;

@Component
@RequiredArgsConstructor
public class PaymentValidator {

    private final PaymentMethodRepository paymentMethodRepository;

    public void validateCheckoutPaymentMethod(String paymentMethodToken) {
        if (paymentMethodToken == null || paymentMethodToken.isBlank()) {
            throw new InvalidPaymentTokenException("Payment method token is required.");
        }

        String normalized = paymentMethodToken.trim();
        if (!(normalized.startsWith("pm_") || normalized.startsWith("tok_"))) {
            throw new InvalidPaymentTokenException("Invalid payment method token: " + paymentMethodToken);
        }
    }

    public void validateStoredPaymentMethod(UUID userId, UUID paymentMethodId) {
        if (paymentMethodId == null) {
            throw new InvalidPaymentTokenException("Payment method ID is required.");
        }

        PaymentMethod paymentMethod = paymentMethodRepository.findById(paymentMethodId)
                .filter(method -> method.getUserId().equals(userId))
                .orElseThrow(() -> new InvalidPaymentException(
                        "Payment method not found: " + paymentMethodId));

        if (paymentMethod.getType() == null || paymentMethod.getType().isBlank()) {
            throw new InvalidPaymentException("Stored payment method is invalid: " + paymentMethodId);
        }
    }
}