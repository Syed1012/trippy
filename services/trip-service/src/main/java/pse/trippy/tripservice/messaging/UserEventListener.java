package pse.trippy.tripservice.messaging;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import pse.trippy.tripservice.config.RabbitMQConfig;
import pse.trippy.tripservice.model.entity.Participant;
import pse.trippy.tripservice.repository.ParticipantRepository;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@Component
@Slf4j
@RequiredArgsConstructor
public class UserEventListener {

    private final ParticipantRepository participantRepository;

    @RabbitListener(queues = RabbitMQConfig.USER_REGISTERED_QUEUE)
    @Transactional
    public void handleUserRegistered(Map<String, Object> event) {
        log.info("Received user.registered event: {}", event);
        try {
            String email = (String) event.get("email");
            String userIdStr = (String) event.get("userId");
            if (email == null || userIdStr == null) {
                log.warn("Missing email or userId in user.registered event");
                return;
            }

            UUID userId = UUID.fromString(userIdStr);
            List<Participant> pendingInvites = participantRepository.findByEmailAndUserIdIsNull(email);
            if (!pendingInvites.isEmpty()) {
                log.info("Linking {} pending invites for email {} to userId {}", pendingInvites.size(), email, userId);
                for (Participant p : pendingInvites) {
                    // Check if they are already a participant via some other means
                    if (participantRepository.existsByTripIdAndUserId(p.getTrip().getId(), userId)) {
                        log.warn("User {} is already a participant in trip {}. Deleting pending invite by email.", userId, p.getTrip().getId());
                        participantRepository.delete(p);
                    } else {
                        p.setUserId(userId);
                        participantRepository.save(p);
                    }
                }
            }
        } catch (Exception e) {
            log.error("Failed to process user.registered event", e);
        }
    }
}
