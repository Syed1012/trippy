package pse.trippy.tripservice.exception;

public class TripLimitExceededException extends RuntimeException {
    private static final long serialVersionUID = 1L;

    public TripLimitExceededException() {
        super("FREE_PLAN_LIMIT_EXCEEDED");
    }
}