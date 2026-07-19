package pse.trippy.notificationservice.controller;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import pse.trippy.notificationservice.dto.response.NotificationResponse;
import pse.trippy.notificationservice.model.enums.NotificationType;
import pse.trippy.notificationservice.service.NotificationService;
import pse.trippy.notificationservice.service.SseNotificationService;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class NotificationControllerTest {

    @Mock
    private NotificationService notificationService;

    @Mock
    private SseNotificationService sseNotificationService;

    private NotificationController controller;

    @BeforeEach
    void setUp() {
        controller = new NotificationController(notificationService, sseNotificationService);
    }

    @Test
    void getNotifications_returnsPagedNotifications() {
        UUID userId = UUID.randomUUID();
        NotificationResponse notification = notificationResponse(userId);
        when(notificationService.getNotifications(userId, 0, 10, false, null))
                .thenReturn(new PageImpl<>(List.of(notification), PageRequest.of(0, 10), 1));

        ResponseEntity<?> response = controller.getNotifications(userId, 0, 10, false, null);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isInstanceOf(Page.class);
        @SuppressWarnings("unchecked")
        Page<NotificationResponse> body = (Page<NotificationResponse>) response.getBody();
        assertThat(body.getTotalElements()).isEqualTo(1);
        assertThat(body.getContent()).containsExactly(notification);
        verify(notificationService).getNotifications(userId, 0, 10, false, null);
    }

    @Test
    void getUnreadCount_returnsCountPayload() {
        UUID userId = UUID.randomUUID();
        when(notificationService.getUnreadCount(userId)).thenReturn(3L);

        ResponseEntity<Map<String, Long>> response = controller.getUnreadCount(userId);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).containsEntry("count", 3L);
    }

    @Test
    void markAsRead_delegatesToService() {
        UUID userId = UUID.randomUUID();
        UUID notificationId = UUID.randomUUID();
        when(notificationService.markAsRead(notificationId, userId)).thenReturn(true);

        ResponseEntity<Void> response = controller.markAsRead(notificationId, userId);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        verify(notificationService).markAsRead(notificationId, userId);
    }

    @Test
    void markAllAsRead_delegatesToService() {
        UUID userId = UUID.randomUUID();

        ResponseEntity<Void> response = controller.markAllAsRead(userId);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        verify(notificationService).markAllAsRead(userId);
    }

    @Test
    void deleteNotification_delegatesToService() {
        UUID userId = UUID.randomUUID();
        UUID notificationId = UUID.randomUUID();
        when(notificationService.deleteNotification(notificationId, userId)).thenReturn(true);

        ResponseEntity<Void> response = controller.deleteNotification(notificationId, userId);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
        verify(notificationService).deleteNotification(notificationId, userId);
    }

    private NotificationResponse notificationResponse(UUID userId) {
        return new NotificationResponse(
                UUID.randomUUID(),
                UUID.randomUUID(),
                userId,
                NotificationType.SYSTEM,
                "Title",
                "Body",
                "Body",
                "/dashboard",
                Map.of("source", "test"),
                false,
                Instant.now(),
                null);
    }
}
