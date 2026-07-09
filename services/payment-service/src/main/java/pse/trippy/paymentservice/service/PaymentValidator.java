package pse.trippy.paymentservice.service;

import org.springframework.stereotype.Component;
import pse.trippy.paymentservice.dto.PaymentRequest;
import pse.trippy.paymentservice.exception.InvalidPaymentTokenException;

/**
 * Validates payment requests before they are processed.
 */
@Component
public class PaymentValidator {

    /**
     * Validates the payment token within a payment request.
     *
     * @param request The payment request to validate.
     * @throws InvalidPaymentTokenException if the payment token is invalid.
     */
    public void validatePayment(PaymentRequest request) {
        String token = request.paymentMethodToken();

        // A real implementation would check the token format, length, and prefix.
        // e.g., Stripe tokens start with "tok_", Braintree with "fake-valid-nonce"
        if (token == null || token.isBlank() || !token.startsWith("tok_")) {
            throw new InvalidPaymentTokenException("Invalid or missing payment method token.");
        }
    }
}