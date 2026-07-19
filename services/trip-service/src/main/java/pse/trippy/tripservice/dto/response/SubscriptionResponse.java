package pse.trippy.tripservice.dto.response;

public record SubscriptionResponse(
        String plan,
        boolean active,
        String currentPeriodStart,
        String currentPeriodEnd
) {}