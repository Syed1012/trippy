package pse.trippy.notificationservice.service;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import org.junit.jupiter.api.Test;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import pse.trippy.notificationservice.dto.request.UpdateNotificationPreferenceRequest;
import pse.trippy.notificationservice.model.entity.NotificationPreference;
import pse.trippy.notificationservice.model.enums.NotificationChannel;
import pse.trippy.notificationservice.model.enums.NotificationType;
import pse.trippy.notificationservice.repository.NotificationPreferenceRepository;

class NotificationPreferenceServiceTest {

    private final NotificationPreferenceRepository repository = mock(NotificationPreferenceRepository.class);
    private final NotificationPreferenceService service = new NotificationPreferenceService(repository);

    @Test
    void paymentFailurePreferencesCanDisableEveryChannel() {
        UUID userId = UUID.randomUUID();
        NotificationPreference preference = NotificationPreference.builder()
                .userId(userId)
                .type(NotificationType.PAYMENT_FAILED)
                .emailEnabled(false)
                .pushEnabled(false)
                .inAppEnabled(false)
                .build();
        when(repository.findByUserIdAndType(userId, NotificationType.PAYMENT_FAILED))
            .thenReturn(Optional.of(preference));
        when(repository.save(any(NotificationPreference.class))).thenReturn(preference);

        var updated = service.updatePreferences(userId, List.of(
                new UpdateNotificationPreferenceRequest(NotificationType.PAYMENT_FAILED, false, false, false)));

        assertThat(updated).singleElement().satisfies(response -> {
            assertThat(response.type()).isEqualTo(NotificationType.PAYMENT_FAILED);
            assertThat(response.emailEnabled()).isFalse();
            assertThat(response.pushEnabled()).isFalse();
            assertThat(response.inAppEnabled()).isFalse();
        });
        assertThat(service.isChannelEnabled(userId, NotificationType.PAYMENT_FAILED, NotificationChannel.EMAIL)).isFalse();
        assertThat(service.isChannelEnabled(userId, NotificationType.PAYMENT_FAILED, NotificationChannel.PUSH)).isFalse();
        assertThat(service.isChannelEnabled(userId, NotificationType.PAYMENT_FAILED, NotificationChannel.IN_APP)).isFalse();
    }
}