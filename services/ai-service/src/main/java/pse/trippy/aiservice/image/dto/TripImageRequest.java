package pse.trippy.aiservice.image.dto;

import jakarta.validation.constraints.NotBlank;

import java.util.UUID;

/**
 * Context for generating a trip cover image. The destination drives the scene;
 * preferences (optional) nudge the mood.
 */
public record TripImageRequest(
        UUID tripId,
        @NotBlank String destination,
        PreferenceContext preferences
) {

    public record PreferenceContext(
            String tripType,
            String budgetTier,
            String preferredWeather,
            String notes
    ) {
    }
}
