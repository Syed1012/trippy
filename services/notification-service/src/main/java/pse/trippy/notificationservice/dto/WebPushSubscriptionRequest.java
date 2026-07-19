package pse.trippy.notificationservice.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class WebPushSubscriptionRequest {
    @NotBlank(message = "Push endpoint is required")
    private String endpoint;

    @NotNull(message = "Push subscription keys are required")
    @Valid
    private Keys keys;

    @Data
    public static class Keys {
        @NotBlank(message = "Push p256dh key is required")
        private String p256dh;

        @NotBlank(message = "Push auth key is required")
        private String auth;
    }
}
