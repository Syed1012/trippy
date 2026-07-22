package pse.trippy.aiservice.places.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;

import java.util.List;

/**
 * Request for POST /ai/places/rank — the user's search intent plus the candidate
 * places (with their ratings/review snippets) to be ranked by the model.
 */
public record PlaceRankRequest(
        @NotBlank @Size(max = 200) String query,
        @NotEmpty @Size(max = 10) @Valid List<RankPlace> places
) {

    public record RankPlace(
            @NotBlank String id,
            @NotBlank @Size(max = 200) String name,
            @Size(max = 100) String category,
            @Size(max = 300) String address,
            Double rating,
            Integer reviewCount,
            @Size(max = 6) List<String> reviewSnippets
    ) {
    }
}
