package pse.trippy.userservice.exception;

/**
 * Thrown when password verification fails for sensitive account operations.
 * Maps to HTTP 400 Bad Request.
 */
public class InvalidPasswordException extends RuntimeException {

    public InvalidPasswordException(String message) {
        super(message);
    }
}
