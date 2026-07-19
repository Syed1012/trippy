package pse.trippy.userservice.exception;

/**
 * Thrown when a user provides an incorrect current password.
 * Maps to HTTP 400 Bad Request.
 */
public class InvalidPasswordException extends RuntimeException {

    public InvalidPasswordException(String message) {
        super(message);
    }
}
