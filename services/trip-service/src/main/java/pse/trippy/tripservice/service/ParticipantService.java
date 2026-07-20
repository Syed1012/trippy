package pse.trippy.tripservice.service;

import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import pse.trippy.tripservice.config.RabbitMQConfig;
import pse.trippy.tripservice.dto.event.ParticipantEvent;
import pse.trippy.tripservice.dto.request.InviteByEmailRequest;
import pse.trippy.tripservice.dto.request.InviteParticipantRequest;
import pse.trippy.tripservice.dto.response.ParticipantActionResponse;
import pse.trippy.tripservice.dto.response.ParticipantResponse;
import pse.trippy.tripservice.exception.ForbiddenException;
import pse.trippy.tripservice.exception.InvalidTripDataException;
import pse.trippy.tripservice.exception.TripNotFoundException;
import pse.trippy.tripservice.model.entity.Participant;
import pse.trippy.tripservice.model.entity.Trip;
import pse.trippy.tripservice.model.enums.ParticipantRole;
import pse.trippy.tripservice.model.enums.ParticipantStatus;
import pse.trippy.tripservice.model.enums.TripVisibility;
import pse.trippy.tripservice.repository.ParticipantRepository;
import pse.trippy.tripservice.repository.TripRepository;

@Service
@Slf4j
@RequiredArgsConstructor
public class ParticipantService {

    private final ParticipantRepository participantRepository;
    private final TripRepository tripRepository;
    private final RabbitTemplate rabbitTemplate;

    @Transactional
    public ParticipantActionResponse inviteParticipant(UUID tripId, InviteParticipantRequest request, UUID inviterId) {
        log.info("Inviting user {} to trip {} by inviter {}", request.userId(), tripId, inviterId);
        Trip trip = findTripOrThrow(tripId);

        // Any accepted participant can propose an invite
        Participant inviter = participantRepository.findByTripIdAndUserId(tripId, inviterId)
                .filter(p -> p.getStatus() == ParticipantStatus.ACCEPTED)
                .orElseThrow(() -> new ForbiddenException("You are not a participant of this trip"));

        if (participantRepository.existsByTripIdAndUserId(tripId, request.userId())) {
            throw new InvalidTripDataException("User is already a participant of this trip");
        }

        long currentCount = participantRepository.countByTripIdAndStatusIn(
                tripId, List.of(ParticipantStatus.INVITED, ParticipantStatus.ACCEPTED, ParticipantStatus.PENDING_APPROVAL));
        if (currentCount >= trip.getMaxParticipants()) {
            throw new InvalidTripDataException("Trip has reached maximum number of participants");
        }

        // If inviter is owner/editor, directly invite. Otherwise, needs owner approval.
        boolean directInvite = inviter.getRole() == ParticipantRole.OWNER
                || inviter.getRole() == ParticipantRole.EDITOR;

        Participant participant = Participant.builder()
                .trip(trip)
                .userId(request.userId())
                .role(ParticipantRole.MEMBER)
                .status(directInvite ? ParticipantStatus.INVITED : ParticipantStatus.PENDING_APPROVAL)
                .build();
        participant = participantRepository.save(participant);

        if (directInvite) {
            log.info("User {} invited to trip {} directly by owner/editor", request.userId(), tripId);
            publishInviteNotification(trip, request.userId(), request.email(), request.inviteeName(), inviterId, request.message(), request.inviterName());
            return new ParticipantActionResponse("Participant invited successfully", toResponse(participant));
        } else {
            log.info("User {} invite proposed for trip {} — awaiting owner approval", request.userId(), tripId);
            publishInviteProposedEvent(trip, request.userId(), inviterId, request.inviterName(), request.message());
            return new ParticipantActionResponse("Invite proposed — awaiting owner approval", toResponse(participant));
        }
    }

    @Transactional
    public ParticipantActionResponse inviteByEmail(UUID tripId, InviteByEmailRequest request, UUID inviterId) {
        log.info("Inviting by email to trip {} by inviter {}", tripId, inviterId);
        Trip trip = findTripOrThrow(tripId);
        String email = request.email().trim().toLowerCase(Locale.ROOT);

        // Any accepted participant can share the trip via email
        participantRepository.findByTripIdAndUserId(tripId, inviterId)
                .filter(p -> p.getStatus() == ParticipantStatus.ACCEPTED)
                .orElseThrow(() -> new ForbiddenException("You are not a participant of this trip"));

        long currentCount = participantRepository.countByTripIdAndStatusIn(
                tripId, List.of(ParticipantStatus.INVITED, ParticipantStatus.ACCEPTED, ParticipantStatus.PENDING_APPROVAL));
        if (currentCount >= trip.getMaxParticipants()) {
            throw new InvalidTripDataException("Trip has reached maximum number of participants");
        }

        Optional<String> existingUserUuidStr = participantRepository.findUserIdByEmail(email);
        UUID userId = existingUserUuidStr.map(UUID::fromString).orElse(null);

        if (userId != null) {
            if (participantRepository.existsByTripIdAndUserId(tripId, userId)) {
                throw new InvalidTripDataException("User is already a participant or has a pending invite for this trip");
            }
        } else {
            if (participantRepository.existsByTripIdAndEmail(tripId, email)) {
                throw new InvalidTripDataException("An invite has already been sent to this email address");
            }
        }

        Participant participant = Participant.builder()
                .trip(trip)
                .userId(userId)
                .email(email)
                .role(ParticipantRole.MEMBER)
                .status(ParticipantStatus.INVITED)
                .build();
        participant = participantRepository.save(participant);

        publishEmailInvitation(trip, email, inviterId, request.message(), request.inviterName());

        return new ParticipantActionResponse("Invitation email sent", toResponse(participant));
    }

    @Transactional
    public ParticipantActionResponse approveInvite(UUID tripId, UUID targetUserId, UUID approverId) {
        log.info("Owner {} approving invite of user {} for trip {}", approverId, targetUserId, tripId);
        Trip trip = findTripOrThrow(tripId);
        ensureOwner(tripId, approverId);

        Participant participant = participantRepository.findByTripIdAndUserId(tripId, targetUserId)
                .orElseThrow(() -> new InvalidTripDataException("No pending invite found for this user"));

        if (participant.getStatus() != ParticipantStatus.PENDING_APPROVAL) {
            throw new InvalidTripDataException("Invite is not pending approval");
        }

        participant.setStatus(ParticipantStatus.ACCEPTED);
        participant.setJoinedAt(Instant.now());
        participant = participantRepository.save(participant);

        log.info("Join request approved for user {} on trip {}", targetUserId, tripId);
        publishApprovalNotification(trip, targetUserId, approverId);

        return new ParticipantActionResponse("Join request approved successfully", toResponse(participant));
    }

    @Transactional
    public ParticipantActionResponse rejectInvite(UUID tripId, InviteParticipantRequest request, UUID rejecterId) {
        log.info("Owner {} rejecting invite/request for trip {}", rejecterId, tripId);
        findTripOrThrow(tripId);
        ensureOwner(tripId, rejecterId);

        Participant participant;
        if (request.userId() != null) {
            participant = participantRepository.findByTripIdAndUserId(tripId, request.userId())
                    .orElseThrow(() -> new InvalidTripDataException("No pending invite found for this user"));
        } else if (request.email() != null && !request.email().isBlank()) {
            participant = participantRepository.findByTripIdAndEmail(tripId, request.email())
                    .orElseThrow(() -> new InvalidTripDataException("No pending invite found for this email"));
        } else {
            throw new InvalidTripDataException("Either userId or email must be provided to reject invite");
        }

        if (participant.getStatus() != ParticipantStatus.PENDING_APPROVAL
                && participant.getStatus() != ParticipantStatus.INVITED) {
            throw new InvalidTripDataException("Participant is not in a pending or invited state");
        }

        ParticipantStatus previousStatus = participant.getStatus();
        UUID rejectedUserId = participant.getUserId();
        participantRepository.delete(participant);

        if (previousStatus == ParticipantStatus.PENDING_APPROVAL && rejectedUserId != null) {
            publishJoinRequestResolution(tripId, rejectedUserId, rejecterId, "trip.participant.rejected");
        }

        log.info("Invite rejected/revoked for trip {}", tripId);

        return new ParticipantActionResponse("Invite rejected", null);
    }

    @Transactional
    public ParticipantActionResponse acceptInvite(UUID tripId, UUID userId) {
        return acceptInvite(tripId, userId, null);
    }

    @Transactional
    public ParticipantActionResponse acceptInvite(UUID tripId, UUID userId, String displayName) {
        log.info("User {} accepting invite for trip {}", userId, tripId);
        Trip trip = findTripOrThrow(tripId);

        Participant participant = participantRepository.findByTripIdAndUserId(tripId, userId)
                .orElseThrow(() -> new InvalidTripDataException("No invitation found for this trip"));

        if (participant.getStatus() != ParticipantStatus.INVITED) {
            throw new InvalidTripDataException("Invitation is not in INVITED status");
        }

        participant.setStatus(ParticipantStatus.ACCEPTED);
        participant.setJoinedAt(Instant.now());
        participant = participantRepository.save(participant);

        log.info("User {} joined trip {} successfully", userId, tripId);
        publishParticipantJoinedEvent(trip, userId, displayName);

        return new ParticipantActionResponse("Invitation accepted successfully", toResponse(participant));
    }

    @Transactional
    public ParticipantActionResponse declineInvite(UUID tripId, UUID userId) {
        log.info("User {} declining invite for trip {}", userId, tripId);
        Trip trip = findTripOrThrow(tripId);

        Participant participant = participantRepository.findByTripIdAndUserId(tripId, userId)
                .orElseThrow(() -> new InvalidTripDataException("No invitation found for this trip"));

        if (participant.getStatus() != ParticipantStatus.INVITED) {
            throw new InvalidTripDataException("Invitation is not in INVITED status");
        }

        participant.setStatus(ParticipantStatus.DECLINED);
        participant = participantRepository.save(participant);

        log.info("User {} declined invite for trip {}", userId, tripId);
        publishInvitationDeclinedEvent(trip, userId);

        return new ParticipantActionResponse("Invitation declined successfully", toResponse(participant));
    }

    @Transactional
    public ParticipantActionResponse requestJoin(UUID tripId, UUID userId, String requesterName, String message) {
        log.info("User {} requesting to join public trip {}", userId, tripId);
        Trip trip = findTripOrThrow(tripId);

        if (trip.getVisibility() != TripVisibility.PUBLIC) {
            throw new ForbiddenException("This trip is not public. You can only join public trips.");
        }

        if (participantRepository.existsByTripIdAndUserId(tripId, userId)) {
            throw new InvalidTripDataException("You are already a participant or have a pending request for this trip");
        }

        long currentCount = participantRepository.countByTripIdAndStatusIn(
                tripId, List.of(ParticipantStatus.INVITED, ParticipantStatus.ACCEPTED, ParticipantStatus.PENDING_APPROVAL));
        if (currentCount >= trip.getMaxParticipants()) {
            throw new InvalidTripDataException("Trip has reached maximum number of participants");
        }

        Participant participant = Participant.builder()
                .trip(trip)
                .userId(userId)
                .role(ParticipantRole.MEMBER)
                .status(ParticipantStatus.PENDING_APPROVAL)
                .build();
        participant = participantRepository.save(participant);

        log.info("User {} join request created for trip {} — awaiting owner approval", userId, tripId);

        // Notify the trip owner about the join request
        publishJoinRequestEvent(trip, userId, requesterName, message);

        return new ParticipantActionResponse(
                "Your request to join has been sent. The trip owner needs to approve it.",
                toResponse(participant));
    }

    @Transactional
    public void leaveTrip(UUID tripId, UUID userId) {
        leaveTrip(tripId, userId, null);
    }

    @Transactional
    public void leaveTrip(UUID tripId, UUID userId, String displayName) {
        log.info("User {} leaving trip {}", userId, tripId);
        findTripOrThrow(tripId);

        Participant participant = participantRepository.findByTripIdAndUserId(tripId, userId)
                .orElseThrow(() -> new ForbiddenException("You are not a participant of this trip"));

        if (participant.getRole() == ParticipantRole.OWNER) {
            throw new ForbiddenException("Owner cannot leave the trip. Delete the trip instead.");
        }

        participantRepository.delete(participant);

        log.info("User {} left trip {} successfully", userId, tripId);
        publishEvent("trip.participant.left", tripId, userId, displayName);
    }

    @Transactional(readOnly = true)
    public List<ParticipantResponse> listParticipants(UUID tripId, UUID userId) {
        Trip trip = findTripOrThrow(tripId);

        // Allow read access for public trips; otherwise require accepted participant
        if (trip.getVisibility() != TripVisibility.PUBLIC) {
            participantRepository.findByTripIdAndUserId(tripId, userId)
                    .filter(p -> p.getStatus() == ParticipantStatus.ACCEPTED)
                    .orElseThrow(() -> new ForbiddenException("You are not a participant of this trip"));
        }

        return participantRepository.findByTripId(tripId).stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public boolean isAcceptedParticipant(UUID tripId, UUID userId) {
        return participantRepository.existsByTripIdAndUserIdAndStatus(
                tripId, userId, ParticipantStatus.ACCEPTED);
    }

    @Transactional
    public ParticipantActionResponse kickParticipant(UUID tripId, UUID targetUserId, UUID kickerId) {
        log.info("Owner {} kicking user {} from trip {}", kickerId, targetUserId, tripId);
        findTripOrThrow(tripId);
        ensureOwner(tripId, kickerId);

        Participant participant = participantRepository.findByTripIdAndUserId(tripId, targetUserId)
                .orElseThrow(() -> new InvalidTripDataException("User is not a participant of this trip"));

        if (participant.getRole() == ParticipantRole.OWNER) {
            throw new ForbiddenException("Cannot kick the trip owner");
        }

        participantRepository.delete(participant);
        log.info("User {} kicked from trip {} by owner {}", targetUserId, tripId, kickerId);

        return new ParticipantActionResponse("Participant removed from trip", null);
    }

    // ── Helpers ──────────────────────────────────────────────────────────

    private Trip findTripOrThrow(UUID tripId) {
        return tripRepository.findById(tripId)
                .orElseThrow(() -> new TripNotFoundException(tripId));
    }

    private void ensureOwner(UUID tripId, UUID userId) {
        participantRepository.findByTripIdAndUserId(tripId, userId)
                .filter(p -> p.getRole() == ParticipantRole.OWNER)
                .orElseThrow(() -> new ForbiddenException(
                        "Only the trip owner can perform this action"));
    }

    private ParticipantResponse toResponse(Participant p) {
        return new ParticipantResponse(
                p.getId(),
                p.getUserId(),
                p.getEmail(),
                p.getRole().name(),
                p.getStatus().name(),
                p.getJoinedAt()
        );
    }

    private void publishEvent(String routingKey, UUID tripId, UUID userId) {
        publishEvent(routingKey, tripId, userId, null);
    }

    private void publishEvent(String routingKey, UUID tripId, UUID userId, String displayName) {
        ParticipantEvent event = new ParticipantEvent(routingKey, tripId, userId, displayName, Instant.now());
        rabbitTemplate.convertAndSend(RabbitMQConfig.TRIP_EXCHANGE, routingKey, event);
    }

    private void publishJoinRequestEvent(Trip trip, UUID requesterId, String requesterName, String message) {
        // Find the trip owner
        Participant owner = participantRepository.findByTripId(trip.getId()).stream()
                .filter(p -> p.getRole() == ParticipantRole.OWNER)
                .findFirst()
                .orElse(null);
        if (owner == null) return;

        Map<String, Object> event = new HashMap<>();
        event.put("eventType", "trip.participant.join_requested");
        event.put("tripId", trip.getId().toString());
        event.put("tripTitle", trip.getTitle());
        event.put("userId", owner.getUserId().toString());
        event.put("requesterId", requesterId.toString());
        event.put("timestamp", Instant.now().toString());
        if (requesterName != null && !requesterName.isBlank()) {
            event.put("requesterName", requesterName);
        }
        if (message != null && !message.isBlank()) {
            event.put("joinMessage", message);
        }

        rabbitTemplate.convertAndSend(RabbitMQConfig.TRIP_EXCHANGE, "trip.participant.join_requested", event);
    }

    private void publishInviteProposedEvent(Trip trip, UUID inviteeId, UUID inviterId, String inviterName, String message) {
        Participant owner = participantRepository.findByTripId(trip.getId()).stream()
                .filter(p -> p.getRole() == ParticipantRole.OWNER)
                .findFirst()
                .orElse(null);
        if (owner == null) return;

        Map<String, Object> event = new HashMap<>();
        event.put("eventType", "trip.participant.invite_proposed");
        event.put("tripId", trip.getId().toString());
        event.put("tripTitle", trip.getTitle());
        event.put("userId", owner.getUserId().toString());
        event.put("requesterId", inviteeId.toString());
        event.put("inviterId", inviterId.toString());
        event.put("timestamp", Instant.now().toString());
        if (inviterName != null && !inviterName.isBlank()) {
            event.put("requesterName", inviterName);
        }
        if (message != null && !message.isBlank()) {
            event.put("joinMessage", message);
        }

        rabbitTemplate.convertAndSend(RabbitMQConfig.TRIP_EXCHANGE, "trip.participant.invite_proposed", event);
    }

    private void publishApprovalNotification(Trip trip, UUID approvedUserId, UUID ownerId) {
        Map<String, Object> event = new HashMap<>();
        event.put("eventType", "trip.participant.approved");
        event.put("tripId", trip.getId().toString());
        event.put("tripTitle", trip.getTitle());
        event.put("userId", approvedUserId.toString());
        event.put("ownerId", ownerId.toString());
        event.put("requesterId", approvedUserId.toString());
        event.put("timestamp", Instant.now().toString());

        rabbitTemplate.convertAndSend(RabbitMQConfig.TRIP_EXCHANGE, "trip.participant.approved", event);
    }

    private void publishJoinRequestResolution(UUID tripId, UUID requesterId, UUID ownerId, String routingKey) {
        Map<String, Object> event = new HashMap<>();
        event.put("eventType", routingKey);
        event.put("tripId", tripId.toString());
        event.put("ownerId", ownerId.toString());
        event.put("requesterId", requesterId.toString());
        event.put("timestamp", Instant.now().toString());
        rabbitTemplate.convertAndSend(RabbitMQConfig.TRIP_EXCHANGE, routingKey, event);
    }

    private void publishInvitationDeclinedEvent(Trip trip, UUID inviteeId) {
        Participant owner = participantRepository.findByTripId(trip.getId()).stream()
                .filter(p -> p.getRole() == ParticipantRole.OWNER)
                .findFirst()
                .orElse(null);

        Map<String, Object> event = new HashMap<>();
        event.put("eventType", "trip.participant.declined");
        event.put("tripId", trip.getId().toString());
        event.put("tripTitle", trip.getTitle());
        event.put("inviteeId", inviteeId.toString());
        event.put("timestamp", Instant.now().toString());
        if (owner != null && owner.getUserId() != null) {
            event.put("ownerId", owner.getUserId().toString());
        }
        rabbitTemplate.convertAndSend(RabbitMQConfig.TRIP_EXCHANGE, "trip.participant.declined", event);
    }

    private void publishParticipantJoinedEvent(Trip trip, UUID inviteeId, String displayName) {
        Participant owner = participantRepository.findByTripId(trip.getId()).stream()
                .filter(p -> p.getRole() == ParticipantRole.OWNER)
                .findFirst()
                .orElse(null);
        if (owner == null || owner.getUserId() == null) {
            log.warn("Trip {} has no owner to notify about accepted invitation", trip.getId());
            return;
        }

        Map<String, Object> event = new HashMap<>();
        event.put("eventType", "trip.participant.joined");
        event.put("tripId", trip.getId().toString());
        event.put("tripTitle", trip.getTitle());
        event.put("userId", owner.getUserId().toString());
        event.put("inviterId", owner.getUserId().toString());
        event.put("inviteeId", inviteeId.toString());
        event.put("participantId", inviteeId.toString());
        event.put("timestamp", Instant.now().toString());
        if (displayName != null && !displayName.isBlank()) {
            event.put("inviteeName", displayName);
            event.put("joinedBy", displayName);
        }

        rabbitTemplate.convertAndSend(RabbitMQConfig.TRIP_EXCHANGE, "trip.participant.joined", event);
    }

    private void publishInviteNotification(Trip trip, UUID inviteeId, String inviteeEmail, String inviteeName, UUID inviterId, String message, String inviterName) {
        Map<String, Object> event = new HashMap<>();
        event.put("eventType", "trip.participant.invited");
        event.put("tripId", trip.getId().toString());
        event.put("tripTitle", trip.getTitle());
        event.put("inviteeId", inviteeId.toString());
        event.put("inviterId", inviterId.toString());
        event.put("timestamp", Instant.now().toString());
        if (inviteeEmail != null && !inviteeEmail.isBlank()) {
            event.put("inviteeEmail", inviteeEmail);
        }
        if (inviteeName != null && !inviteeName.isBlank()) {
            event.put("inviteeName", inviteeName);
        }
        if (inviterName != null && !inviterName.isBlank()) {
            event.put("inviterName", inviterName);
        }
        if (message != null && !message.isBlank()) {
            event.put("inviteMessage", message);
        }

        rabbitTemplate.convertAndSend(RabbitMQConfig.TRIP_EXCHANGE, "trip.participant.invited", event);
    }

    private void publishEmailInvitation(Trip trip, String email, UUID inviterId, String message, String inviterName) {
        Map<String, Object> event = new HashMap<>();
        event.put("eventType", "trip.invitation.created");
        event.put("tripId", trip.getId().toString());
        event.put("tripTitle", trip.getTitle());
        event.put("destination", trip.getDestination());
        event.put("startDate", trip.getStartDate().toString());
        event.put("endDate", trip.getEndDate().toString());
        if (trip.getDescription() != null && !trip.getDescription().isBlank()) {
            event.put("tripDescription", trip.getDescription());
        }
        event.put("inviteeEmail", email);
        event.put("inviterId", inviterId.toString());
        event.put("timestamp", Instant.now().toString());
        if (inviterName != null && !inviterName.isBlank()) {
            event.put("inviterName", inviterName);
        }
        if (message != null && !message.isBlank()) {
            event.put("inviteMessage", message);
        }

        rabbitTemplate.convertAndSend(RabbitMQConfig.TRIP_EXCHANGE, "trip.invitation.created", event);
    }
}
