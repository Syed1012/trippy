package pse.trippy.userservice.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import pse.trippy.userservice.model.enums.SubscriptionPlan;

/** Response body for {@code GET /internal/v1/users/{userId}/subscription}. */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SubscriptionInfoResponse {

    private SubscriptionPlan plan;
    private int tripCount;
    private int generationCount;
}
