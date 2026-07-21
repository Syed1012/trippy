package pse.trippy.tripservice.exception;

public class InvalidTripDataException extends RuntimeException {
    private static final long serialVersionUID = 1L;

    public InvalidTripDataException(String message) {
        super(message);
    }
}
