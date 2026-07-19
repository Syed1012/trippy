package pse.trippy.tripservice.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pse.trippy.tripservice.config.RabbitMQConfig;
import pse.trippy.tripservice.model.entity.Participant;
import pse.trippy.tripservice.model.entity.Trip;
import pse.trippy.tripservice.repository.ParticipantRepository;

import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

@Service
@Slf4j
@RequiredArgsConstructor
public class PendingInviteLinkService {

    private final ParticipantRepository participantRepository;
    private final RabbitTemplate rabbitTemplate;

    @Transactional
    public int linkPendingInvitesForUser(UUID userId) {
        return participantRepository.findEmailByUserId(userId)
                .map(email -> linkPendingInvites(userId, email))
                .orElse(0);
    }

    @Transactional
    public int linkPendingInvites(UUID userId, String email) {
        if (email == null || email.isBlank()) {
            return 0;
        }

        String normalizedEmail = email.trim().toLowerCase(Locale.ROOT);
        List<Participant> pendingInvites = participantRepository
                .findByEmailIgnoreCaseAndUserIdIsNull(normalizedEmail);
        int linkedCount = 0;
        for (Participant participant : pendingInvites) {
            UUID tripId = participant.getTrip().getId();
            if (participantRepository.existsByTripIdAndUserId(tripId, userId)) {
                log.warn("User {} is already a participant in trip {}; removing duplicate email invite", userId, tripId);
                participantRepository.delete(participant);
                continue;
            }

            participant.setUserId(userId);
            participantRepository.save(participant);
            publishLinkedInviteNotification(participant, userId);
            linkedCount++;
        }
        return linkedCount;
    }

    private void publishLinkedInviteNotification(Participant participant, UUID inviteeId) {
        Trip trip = participant.getTrip();
        Map<String, Object> event = new HashMap<>();
        event.put("eventType", "trip.participant.invited");
        event.put("tripId", trip.getId().toString());
        event.put("tripTitle", trip.getTitle());
        event.put("inviteeId", inviteeId.toString());
        event.put("timestamp", Instant.now().toString());
        if (trip.getCreatedBy() != null) {
            event.put("inviterId", trip.getCreatedBy().toString());
        }

        rabbitTemplate.convertAndSend(RabbitMQConfig.TRIP_EXCHANGE, "trip.participant.invited", event);
    }
}
