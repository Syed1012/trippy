package pse.trippy.tripservice.exception;

import java.util.UUID;

public class TripNotFoundException extends RuntimeException {
    private static final long serialVersionUID = 1L;

    public TripNotFoundException(UUID tripId) {
        super("Trip not found: " + tripId);
    }
}
