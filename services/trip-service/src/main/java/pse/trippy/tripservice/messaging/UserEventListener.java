package pse.trippy.tripservice.messaging;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Component;
import pse.trippy.tripservice.config.RabbitMQConfig;
import pse.trippy.tripservice.service.PendingInviteLinkService;

import java.util.Map;
import java.util.UUID;

@Component
@Slf4j
@RequiredArgsConstructor
public class UserEventListener {

    private final PendingInviteLinkService pendingInviteLinkService;

    @RabbitListener(queues = RabbitMQConfig.USER_REGISTERED_QUEUE)
    public void handleUserRegistered(Map<String, Object> event) {
        log.info("Received user.registered event");
        try {
            String email = textValue(event.get("email"));
            String userIdStr = textValue(event.get("userId"));
            if (email == null || userIdStr == null) {
                log.warn("Missing email or userId in user.registered event");
                return;
            }

            UUID userId = UUID.fromString(userIdStr);
            int linkedCount = pendingInviteLinkService.linkPendingInvites(userId, email);
            log.info("Linked {} pending trip invites to newly registered user {}", linkedCount, userId);
        } catch (IllegalArgumentException ex) {
            log.warn("Ignoring user.registered event with an invalid user ID");
        } catch (RuntimeException ex) {
            log.error("Failed to link pending trip invitations for a newly registered user", ex);
            throw ex;
        }
    }

    private String textValue(Object value) {
        if (value == null) {
            return null;
        }
        String text = value.toString().trim();
        return text.isEmpty() ? null : text;
    }

}
