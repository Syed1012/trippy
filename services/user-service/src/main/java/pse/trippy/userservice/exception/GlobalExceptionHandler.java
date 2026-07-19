package pse.trippy.userservice.exception;

import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.WebRequest;
import pse.trippy.userservice.dto.response.ErrorResponse;

import java.time.Instant;
import java.util.List;

/**
 * Global exception handler for REST controllers.
 * 
 * <p>Produces error responses matching the {@code ErrorResponse} schema.
 */
@RestControllerAdvice
@Slf4j
public class GlobalExceptionHandler {

    @ExceptionHandler(UserNotFoundException.class)
    public ResponseEntity<ErrorResponse> handleUserNotFound(
            UserNotFoundException ex, WebRequest request) {

        log.warn("User not found: {}", ex.getMessage());
        ErrorResponse response = ErrorResponse.builder()
                .error("USER_NOT_FOUND")
                .message(ex.getMessage())
                .timestamp(Instant.now())
                .path(extractPath(request))
                .build();
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(response);
    }

    @ExceptionHandler(InvalidCredentialsException.class)
    public ResponseEntity<ErrorResponse> handleInvalidCredentials(
            InvalidCredentialsException ex, WebRequest request) {

        log.warn("Authentication failed: {}", ex.getMessage());
        ErrorResponse response = ErrorResponse.builder()
                .error("UNAUTHORIZED")
                .message(ex.getMessage())
                .timestamp(Instant.now())
                .path(extractPath(request))
                .build();
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(response);
    }

    @ExceptionHandler(InvalidPasswordException.class)
    public ResponseEntity<ErrorResponse> handleInvalidPassword(
            InvalidPasswordException ex, WebRequest request) {

        log.warn("Invalid password: {}", ex.getMessage());
        ErrorResponse response = ErrorResponse.builder()
                .error("INVALID_PASSWORD")
                .message(ex.getMessage())
                .timestamp(Instant.now())
                .path(extractPath(request))
                .build();
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(response);
    }

    @ExceptionHandler(InvalidTokenException.class)
    public ResponseEntity<ErrorResponse> handleInvalidToken(
            InvalidTokenException ex, WebRequest request) {

        log.warn("Token validation failed: {}", ex.getMessage());
        ErrorResponse response = ErrorResponse.builder()
                .error("UNAUTHORIZED")
                .message(ex.getMessage())
                .timestamp(Instant.now())
                .path(extractPath(request))
                .build();
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(response);
    }

    @ExceptionHandler(AccountNotVerifiedException.class)
    public ResponseEntity<ErrorResponse> handleAccountNotVerified(
            AccountNotVerifiedException ex, WebRequest request) {

        log.warn("Account not verified: {}", ex.getMessage());
        ErrorResponse response = ErrorResponse.builder()
                .error("ACCOUNT_NOT_VERIFIED")
                .message(ex.getMessage())
                .timestamp(Instant.now())
                .path(extractPath(request))
                .build();
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(response);
    }

    @ExceptionHandler(EmailAlreadyExistsException.class)
    public ResponseEntity<ErrorResponse> handleEmailAlreadyExists(
            EmailAlreadyExistsException ex, WebRequest request) {

        log.warn("Email already exists: {}", ex.getMessage());
        ErrorResponse response = ErrorResponse.builder()
                .error("EMAIL_ALREADY_EXISTS")
                .message(ex.getMessage())
                .timestamp(Instant.now())
                .path(extractPath(request))
                .build();
        return ResponseEntity.status(HttpStatus.CONFLICT).body(response);
    }

    @ExceptionHandler(VerificationTokenExpiredException.class)
    public ResponseEntity<ErrorResponse> handleVerificationTokenExpired(
            VerificationTokenExpiredException ex, WebRequest request) {

        log.warn("Verification token expired: {}", ex.getMessage());
        ErrorResponse response = ErrorResponse.builder()
                .error("TOKEN_EXPIRED")
                .message(ex.getMessage())
                .timestamp(Instant.now())
                .path(extractPath(request))
                .build();
        return ResponseEntity.status(HttpStatus.GONE).body(response);
    }

    @ExceptionHandler(EmailAlreadyVerifiedException.class)
    public ResponseEntity<ErrorResponse> handleEmailAlreadyVerified(
            EmailAlreadyVerifiedException ex, WebRequest request) {

        log.warn("Email already verified: {}", ex.getMessage());
        ErrorResponse response = ErrorResponse.builder()
                .error("EMAIL_ALREADY_VERIFIED")
                .message(ex.getMessage())
                .timestamp(Instant.now())
                .path(extractPath(request))
                .build();
        return ResponseEntity.status(HttpStatus.CONFLICT).body(response);
    }

    @ExceptionHandler(RateLimitExceededException.class)
    public ResponseEntity<ErrorResponse> handleRateLimitExceeded(
            RateLimitExceededException ex, WebRequest request) {

        log.warn("Rate limit exceeded: {}", ex.getMessage());
        ErrorResponse response = ErrorResponse.builder()
                .error("RATE_LIMIT_EXCEEDED")
                .message(ex.getMessage())
                .timestamp(Instant.now())
                .path(extractPath(request))
                .build();
        return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS).body(response);
    }

    /**
     * Handles validation errors (400 Bad Request).
     */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorResponse> handleValidationException(
            MethodArgumentNotValidException ex, WebRequest request) {

        List<ErrorResponse.FieldError> fieldErrors = ex.getBindingResult()
                .getFieldErrors()
                .stream()
                .map(error -> ErrorResponse.FieldError.builder()
                        .field(error.getField())
                        .message(error.getDefaultMessage())
                        .build())
                .toList();

        ErrorResponse response = ErrorResponse.builder()
                .error("VALIDATION_ERROR")
                .message("Invalid input provided")
                .timestamp(Instant.now())
                .path(extractPath(request))
                .details(fieldErrors)
                .build();

        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(response);
    }

    /**
     * Handles all other uncaught exceptions (500 Internal Server Error).
     */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> handleGenericException(
            Exception ex, WebRequest request) {

        log.error("Unexpected error occurred", ex);
        ErrorResponse response = ErrorResponse.builder()
                .error("INTERNAL_SERVER_ERROR")
                .message("An unexpected error occurred")
                .timestamp(Instant.now())
                .path(extractPath(request))
                .build();

        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
    }

    private String extractPath(WebRequest request) {
        return request.getDescription(false).replace("uri=", "");
    }
}
