package pse.trippy.aiservice.places.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;

import java.util.List;

/**
 * Request for POST /ai/places/insights — a batch of searched places for which
 * the model writes realistic ratings and short reviews.
 */
public record PlaceInsightsRequest(
        @NotEmpty @Size(max = 10) @Valid List<PlaceRef> places
) {
    public PlaceInsightsRequest {
        places = List.copyOf(places);
    }

    public record PlaceRef(
            @NotBlank String id,
            @NotBlank @Size(max = 200) String name,
            @Size(max = 100) String category,
            @Size(max = 300) String address
    ) {
    }
}
