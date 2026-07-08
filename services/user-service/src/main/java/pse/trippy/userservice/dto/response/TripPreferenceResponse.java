package pse.trippy.userservice.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import pse.trippy.userservice.model.enums.BudgetTier;
import pse.trippy.userservice.model.enums.PreferredWeather;
import pse.trippy.userservice.model.enums.TripType;

import java.time.Instant;
import java.util.UUID;

/**
 * Response DTO for trip preference endpoints.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TripPreferenceResponse {

    private UUID preferenceId;
    private UUID userId;
    private UUID tripId;
    private TripType tripType;
    private BudgetTier budgetTier;
    private PreferredWeather preferredWeather;
    private String notes;
    private Instant createdAt;
    private Instant updatedAt;
}
