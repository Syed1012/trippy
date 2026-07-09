package pse.trippy.aiservice.recommendation.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;

import java.util.List;
import java.util.UUID;

/**
 * Context sent from the trip AI sidebar to build local Ollama itinerary suggestions.
 *
 * @param tripId            owning trip (used to persist/replace stored recommendations); optional
 * @param destination       trip destination (required for prompting)
 * @param days              total number of trip days
 * @param dayNumber         when present, regenerate suggestions for only this single day
 * @param preferences       captured trip travel preferences (nullable)
 * @param existingItinerary already-filled day plans to avoid duplicating (nullable/empty)
 */
public record RecommendationRequest(
        UUID tripId,
        @NotBlank String destination,
        @Min(1) @Max(60) int days,
        Integer dayNumber,
        PreferenceContext preferences,
        List<DayContext> existingItinerary
) {

    public record PreferenceContext(
            String tripType,
            String budgetTier,
            String preferredWeather,
            String notes
    ) {
    }

    public record DayContext(
            Integer dayNumber,
            String title,
            List<ActivityContext> activities
    ) {
    }

    public record ActivityContext(
            String time,
            String title,
            String estimatedCost
    ) {
    }
}
