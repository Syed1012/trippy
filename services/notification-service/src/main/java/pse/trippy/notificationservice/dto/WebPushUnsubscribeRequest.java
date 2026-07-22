package pse.trippy.notificationservice.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class WebPushUnsubscribeRequest {
    @NotBlank(message = "Push endpoint is required")
    private String endpoint;
}
