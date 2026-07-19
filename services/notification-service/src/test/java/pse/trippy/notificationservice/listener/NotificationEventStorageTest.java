package pse.trippy.notificationservice.listener;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase.Replace;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;
import com.fasterxml.jackson.databind.ObjectMapper;
import pse.trippy.notificationservice.model.entity.Notification;
import pse.trippy.notificationservice.model.enums.NotificationType;
import pse.trippy.notificationservice.repository.NotificationRepository;
import pse.trippy.notificationservice.service.EmailService;
import pse.trippy.notificationservice.service.NotificationService;
import pse.trippy.notificationservice.service.WebPushService;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

@DataJpaTest
@AutoConfigureTestDatabase(replace = Replace.NONE)
@ActiveProfiles("test")
@Import({NotificationService.class, NotificationEventListener.class, ObjectMapper.class})
@DisplayName("Notification event storage")
class NotificationEventStorageTest {

    @Autowired
    private NotificationEventListener listener;

    @Autowired
    private NotificationRepository notificationRepository;

    @MockBean
    private EmailService emailService;

    @MockBean
    private WebPushService webPushService;

    @Test
    @DisplayName("trip invitation event stores an in-app notification")
    void tripInvitationEventStoresNotification() {
        UUID inviteeId = UUID.randomUUID();
        UUID tripId = UUID.randomUUID();

        listener.handleEvent(Map.of(
                "inviteeId", inviteeId.toString(),
                "inviteeEmail", "traveler@test.com",
                "inviteeName", "Traveler",
                "inviterName", "Alex",
                "tripId", tripId.toString(),
                "tripTitle", "Alpine Weekend"), "trip.invitation.created");

        List<Notification> notifications = notificationRepository.findByUserIdAndType(
                inviteeId, NotificationType.TRIP_INVITE);

        assertThat(notifications).hasSize(1);
        assertThat(notifications.get(0).getTitle()).isEqualTo("Trip Invitation");
        assertThat(notifications.get(0).getActionUrl())
                .isEqualTo("/dashboard/trips/" + tripId);
        assertThat(notifications.get(0).getMetadata()).containsEntry("tripTitle", "Alpine Weekend");
    }
}
