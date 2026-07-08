package pse.trippy.tripservice.dto.request;

import jakarta.validation.constraints.NotBlank;

/**
 * Request DTO for {@code PATCH /trips/{tripId}/status}.
 *
 * <p>Dedicated trip status lifecycle operation — moves a trip between
 * {@code DRAFT → PLANNED → ONGOING → COMPLETED} (or {@code CANCELLED}).
 * Restricted to the trip owner.
 */
public record UpdateTripStatusRequest(

        @NotBlank(message = "status is required")
        String status
) {
}
