package pse.trippy.notificationservice.dto.response;

import pse.trippy.notificationservice.model.enums.NotificationType;
import java.util.UUID;

public record NotificationPreferenceResponse(
        UUID id,
        UUID userId,
        NotificationType type,
        boolean emailEnabled,
        boolean pushEnabled,
        boolean inAppEnabled
) {}
