package pse.trippy.notificationservice.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pse.trippy.notificationservice.dto.request.UpdateNotificationPreferenceRequest;
import pse.trippy.notificationservice.dto.response.NotificationPreferenceResponse;
import pse.trippy.notificationservice.model.entity.NotificationPreference;
import pse.trippy.notificationservice.model.enums.NotificationChannel;
import pse.trippy.notificationservice.model.enums.NotificationType;
import pse.trippy.notificationservice.repository.NotificationPreferenceRepository;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class NotificationPreferenceService {

    private final NotificationPreferenceRepository repository;

    private static final Set<NotificationType> CONFIGURABLE_TYPES = Set.of(
            NotificationType.TRIP_INVITE,
            NotificationType.TRIP_JOINED,
            NotificationType.TRIP_UPDATED,
            NotificationType.ITINERARY_READY,
            NotificationType.PAYMENT_SUCCESS,
            NotificationType.SYSTEM
    );

    @Transactional(readOnly = true)
    public List<NotificationPreferenceResponse> getPreferences(UUID userId) {
        List<NotificationPreference> existing = repository.findByUserId(userId);
        Map<NotificationType, NotificationPreference> existingMap = existing.stream()
                .collect(Collectors.toMap(NotificationPreference::getType, p -> p));

        List<NotificationPreferenceResponse> responses = new ArrayList<>();
        for (NotificationType type : CONFIGURABLE_TYPES) {
            NotificationPreference pref = existingMap.get(type);
            if (pref != null) {
                responses.add(toResponse(pref));
            } else {
                responses.add(new NotificationPreferenceResponse(null, userId, type, true, true, true));
            }
        }
        return responses;
    }

    @Transactional
    public List<NotificationPreferenceResponse> updatePreferences(UUID userId, List<UpdateNotificationPreferenceRequest> requests) {
        List<NotificationPreferenceResponse> updatedResponses = new ArrayList<>();

        for (UpdateNotificationPreferenceRequest req : requests) {
            if (!CONFIGURABLE_TYPES.contains(req.type())) {
                continue;
            }

            NotificationPreference preference = repository.findByUserIdAndType(userId, req.type())
                    .orElseGet(() -> NotificationPreference.builder()
                            .userId(userId)
                            .type(req.type())
                            .build());

            preference.setEmailEnabled(req.emailEnabled());
            preference.setPushEnabled(req.pushEnabled());
            preference.setInAppEnabled(req.inAppEnabled());

            NotificationPreference saved = repository.save(preference);
            updatedResponses.add(toResponse(saved));
        }

        return updatedResponses;
    }

    @Transactional(readOnly = true)
    public boolean isChannelEnabled(UUID userId, NotificationType type, NotificationChannel channel) {
        if (userId == null || type == null || channel == null) {
            return true;
        }

        if (type == NotificationType.EMAIL_VERIFICATION || type == NotificationType.PASSWORD_RESET || type == NotificationType.WELCOME) {
            return true;
        }

        if (!CONFIGURABLE_TYPES.contains(type)) {
            return true;
        }

        return repository.findByUserIdAndType(userId, type)
                .map(pref -> switch (channel) {
                    case EMAIL -> pref.isEmailEnabled();
                    case PUSH -> pref.isPushEnabled();
                    case IN_APP -> pref.isInAppEnabled();
                })
                .orElse(true);
    }

    private NotificationPreferenceResponse toResponse(NotificationPreference pref) {
        return new NotificationPreferenceResponse(
                pref.getId(),
                pref.getUserId(),
                pref.getType(),
                pref.isEmailEnabled(),
                pref.isPushEnabled(),
                pref.isInAppEnabled()
        );
    }
}
