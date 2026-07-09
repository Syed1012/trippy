package pse.trippy.paymentservice.dto.response;

import java.math.BigDecimal;
import java.util.List;

public record PlanResponse(
        String id,
        String name,
        String description,
        List<Price> prices,
        List<FeatureResponse> features
) {
    public record Price(String id, String interval, BigDecimal amount, String currency) {
    }
}