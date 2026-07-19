package pse.trippy.userservice.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/** Request body for {@code POST /internal/v1/users/{userId}/subscription/increment}. */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class IncrementSubscriptionRequest {

    @NotBlank(message = "Field is required")
    @Pattern(regexp = "tripCount|generationCount", message = "Field must be 'tripCount' or 'generationCount'")
    private String field;
}
