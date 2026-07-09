package pse.trippy.aiservice.image.dto;

import java.util.UUID;

/**
 * A generated trip cover image.
 *
 * @param tripId   owning trip (echoed back), may be null
 * @param imageUrl deterministic image URL (null when the feature is disabled)
 * @param prompt   the scene prompt that produced the image
 * @param model    the image model used
 * @param source   {@code AI} when the prompt was crafted by the local model, {@code FALLBACK} otherwise
 * @param status   {@code READY} or {@code DISABLED}
 */
public record TripImageResponse(
        UUID tripId,
        String imageUrl,
        String prompt,
        String model,
        String source,
        String status
) {
}
