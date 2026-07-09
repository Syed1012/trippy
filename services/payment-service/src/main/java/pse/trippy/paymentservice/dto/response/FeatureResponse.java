package pse.trippy.paymentservice.dto.response;

public record FeatureResponse(
        String feature,
        boolean included
) {}