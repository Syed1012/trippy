package pse.trippy.paymentservice.exception;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.ResponseStatus;

/**
 * Exception thrown for invalid payment tokens. Results in a 400 Bad Request.
 */
@ResponseStatus(HttpStatus.BAD_REQUEST)
public class InvalidPaymentTokenException extends RuntimeException {
    public InvalidPaymentTokenException(String message) {
        super(message);
    }
}