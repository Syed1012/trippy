package pse.trippy.notificationservice.dto.request;

import jakarta.validation.constraints.NotNull;
import pse.trippy.notificationservice.model.enums.NotificationType;

public record UpdateNotificationPreferenceRequest(
        @NotNull NotificationType type,
        boolean emailEnabled,
        boolean pushEnabled,
        boolean inAppEnabled
) {}
