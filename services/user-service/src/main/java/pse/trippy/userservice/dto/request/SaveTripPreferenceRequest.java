package pse.trippy.userservice.dto.request;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import pse.trippy.userservice.model.enums.BudgetTier;
import pse.trippy.userservice.model.enums.PreferredWeather;

import java.util.UUID;

/**
 * Request DTO for POST /users/trip-preferences.
 *
 * <p>Persists (or updates) the authenticated user's travel preferences for a
 * given trip. Only {@code tripId} is required — every preference field is
 * optional so a user can provide as much or as little as they like.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SaveTripPreferenceRequest {

    @NotNull(message = "tripId is required")
    private UUID tripId;

    /** Comma-separated {@code TripType} names, e.g. "BEACH,CITY" — multiple allowed. */
    private String tripType;

    private BudgetTier budgetTier;

    private PreferredWeather preferredWeather;

    @Size(max = 500, message = "notes must not exceed 500 characters")
    private String notes;
}
