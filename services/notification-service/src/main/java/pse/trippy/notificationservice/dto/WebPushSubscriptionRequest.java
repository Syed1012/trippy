package pse.trippy.notificationservice.dto;

import lombok.Data;

@Data
public class WebPushSubscriptionRequest {
    private String endpoint;
    private Keys keys;

    @Data
    public static class Keys {
        private String p256dh;
        private String auth;
    }
}
