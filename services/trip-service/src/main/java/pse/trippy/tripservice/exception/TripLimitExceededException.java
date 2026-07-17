package pse.trippy.tripservice.exception;

public class TripLimitExceededException extends RuntimeException {
    public TripLimitExceededException() {
        super("FREE_PLAN_LIMIT_EXCEEDED");
    }
}