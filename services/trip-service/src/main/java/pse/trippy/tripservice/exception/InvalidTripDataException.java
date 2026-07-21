package pse.trippy.tripservice.exception;

public class InvalidTripDataException extends RuntimeException {
    public InvalidTripDataException(String message) {
        super(message);
    }
}
