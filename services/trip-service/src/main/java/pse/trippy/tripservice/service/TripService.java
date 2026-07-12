package pse.trippy.tripservice.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.AmqpException;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pse.trippy.tripservice.config.RabbitMQConfig;
import pse.trippy.tripservice.dto.request.CreateTripRequest;
import pse.trippy.tripservice.dto.request.UpdateTripRequest;
import pse.trippy.tripservice.dto.response.ParticipantResponse;
import pse.trippy.tripservice.dto.response.TripDetailResponse;
import pse.trippy.tripservice.dto.response.TripPageResponse;
import pse.trippy.tripservice.dto.response.TripResponse;
import pse.trippy.tripservice.exception.ForbiddenException;
import pse.trippy.tripservice.exception.InvalidTripDataException;
import pse.trippy.tripservice.exception.TripNotFoundException;
import pse.trippy.tripservice.model.entity.Participant;
import pse.trippy.tripservice.model.entity.Trip;
import pse.trippy.tripservice.model.enums.ParticipantRole;
import pse.trippy.tripservice.model.enums.ParticipantStatus;
import pse.trippy.tripservice.model.enums.TripStatus;
import pse.trippy.tripservice.model.enums.TripVisibility;
import pse.trippy.tripservice.repository.ParticipantRepository;
import pse.trippy.tripservice.repository.TripRepository;

import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@Slf4j
@RequiredArgsConstructor
public class TripService {

    private final TripRepository tripRepository;
    private final ParticipantRepository participantRepository;
    private final RabbitTemplate rabbitTemplate;

    @Transactional
    public TripResponse createTrip(CreateTripRequest request, UUID userId) {
        log.info("Creating trip: title='{}' | destination='{}' | dates={}→{} | visibility={} | maxParticipants={} | user={}",
                request.title(), request.destination(),
                request.startDate() != null ? request.startDate() : "unset",
                request.endDate() != null ? request.endDate() : "unset",
                request.visibility() != null ? request.visibility() : "PRIVATE",
                request.maxParticipants() != null ? request.maxParticipants() : 10,
                userId);
        validateDates(request.startDate(), request.endDate());

        Trip trip = Trip.builder()
                .title(request.title())
                .destination(request.destination())
                .description(request.description())
                .startDate(request.startDate())
                .endDate(request.endDate())
                .visibility(parseVisibility(request.visibility()))
                .maxParticipants(request.maxParticipants() != null ? request.maxParticipants() : 10)
                .createdBy(userId)
                .build();

        trip = tripRepository.save(trip);

        // Auto-add creator as OWNER participant with ACCEPTED status
        Participant owner = Participant.builder()
                .trip(trip)
                .userId(userId)
                .role(ParticipantRole.OWNER)
                .status(ParticipantStatus.ACCEPTED)
                .joinedAt(Instant.now())
                .build();
        participantRepository.save(owner);

        long durationDays = (trip.getStartDate() != null && trip.getEndDate() != null)
                ? java.time.temporal.ChronoUnit.DAYS.between(trip.getStartDate(), trip.getEndDate())
                : -1;
        log.info("Trip created: id={} | '{}' → {} | {} | duration={} | visibility={} | owner={}",
                trip.getId(), trip.getTitle(), trip.getDestination(),
                trip.getStatus(),
                durationDays >= 0 ? durationDays + " days" : "dates pending",
                trip.getVisibility(), userId);

        // Notify user-service so it can upgrade the creator's role to HOST
        publishTripCreatedEvent(trip.getId(), userId);

        return toTripResponse(trip);
    }

    @Transactional(readOnly = true)
    public TripPageResponse listMyTrips(UUID userId, int page, int size) {
        log.debug("Listing trips for user={}, page={}, size={}", userId, page, size);
        PageRequest pageRequest = PageRequest.of(page, size, Sort.by(Sort.Direction.ASC, "startDate"));
        Page<Trip> tripPage = tripRepository.findTripsByParticipantUserId(userId, pageRequest);

        log.info("Trips listed: {} of {} total | user={} | page {}/{}",
                tripPage.getNumberOfElements(), tripPage.getTotalElements(),
                userId, page + 1, tripPage.getTotalPages());

        List<Trip> pageTrips = tripPage.getContent();
        List<UUID> tripIds = pageTrips.stream().map(Trip::getId).toList();

        // Resolve the current user's participation status per trip
        Map<UUID, String> userStatusByTrip = new HashMap<>();
        Map<UUID, Integer> memberCountByTrip = new HashMap<>();
        if (!tripIds.isEmpty()) {
            for (Participant p : participantRepository.findByUserIdAndTripIds(userId, tripIds)) {
                userStatusByTrip.put(p.getTrip().getId(), p.getStatus().name());
            }
            for (Participant p : participantRepository.findByTripIdsAndStatusIn(
                    tripIds, List.of(ParticipantStatus.ACCEPTED))) {
                memberCountByTrip.merge(p.getTrip().getId(), 1, Integer::sum);
            }
        }

        List<TripResponse> trips = pageTrips.stream()
                .map(trip -> toTripResponse(
                        trip,
                        userStatusByTrip.get(trip.getId()),
                        memberCountByTrip.getOrDefault(trip.getId(), 0)))
                .toList();

        return new TripPageResponse(
                trips,
                tripPage.getNumber(),
                tripPage.getSize(),
                tripPage.getTotalElements(),
                tripPage.getTotalPages(),
                tripPage.hasNext()
        );
    }

    @Transactional(readOnly = true)
    public TripPageResponse listPublicTrips(UUID userId, int page, int size) {
        log.debug("Listing public trips for user={}, page={}, size={}", userId, page, size);
        PageRequest pageRequest = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"));
        Page<Trip> tripPage = tripRepository.findPublicTripsExcludingUser(userId, pageRequest);

        List<Trip> pageTrips = tripPage.getContent();
        List<UUID> tripIds = pageTrips.stream().map(Trip::getId).toList();

        // Resolve the current user's participation status per trip (for "Requested to Join" state)
        Map<UUID, String> userStatusByTrip = new HashMap<>();
        // Count accepted members per trip
        Map<UUID, Integer> memberCountByTrip = new HashMap<>();
        if (!tripIds.isEmpty()) {
            for (Participant p : participantRepository.findByUserIdAndTripIds(userId, tripIds)) {
                userStatusByTrip.put(p.getTrip().getId(), p.getStatus().name());
            }
            for (Participant p : participantRepository.findByTripIdsAndStatusIn(
                    tripIds, List.of(ParticipantStatus.ACCEPTED))) {
                memberCountByTrip.merge(p.getTrip().getId(), 1, Integer::sum);
            }
        }

        List<TripResponse> trips = pageTrips.stream()
                .map(trip -> toTripResponse(
                        trip,
                        userStatusByTrip.get(trip.getId()),
                        memberCountByTrip.getOrDefault(trip.getId(), 0)))
                .toList();

        return new TripPageResponse(
                trips,
                tripPage.getNumber(),
                tripPage.getSize(),
                tripPage.getTotalElements(),
                tripPage.getTotalPages(),
                tripPage.hasNext()
        );
    }

    @Transactional(readOnly = true)
    public TripDetailResponse getTripDetail(UUID tripId, UUID userId) {
        log.debug("Fetching trip detail: tripId={}, requestedBy={}", tripId, userId);
        Trip trip = findTripOrThrow(tripId);

        // Allow open access only to published (non-DRAFT) public trips; DRAFT
        // trips are never visible to non-participants, even by direct link.
        if (!isPubliclyViewable(trip)) {
            ensureParticipant(tripId, userId);
        }

        List<ParticipantResponse> participants = participantRepository.findByTripId(tripId).stream()
                .map(this::toParticipantResponse)
                .toList();

        return toTripDetailResponse(trip, participants);
    }

    @Transactional(readOnly = true)
    public TripDetailResponse getSharedTripDetail(UUID tripId) {
        log.debug("Fetching shared trip detail: tripId={}", tripId);
        Trip trip = findTripOrThrow(tripId);

        if (!isPubliclyViewable(trip)) {
            throw new ForbiddenException("This trip is not publicly viewable");
        }

        List<ParticipantResponse> participants = participantRepository.findByTripId(tripId).stream()
                .filter(p -> p.getStatus() == ParticipantStatus.ACCEPTED || p.getRole() == ParticipantRole.OWNER)
                .map(this::toParticipantResponse)
                .toList();

        return toTripDetailResponse(trip, participants);
    }

    @Transactional
    public TripResponse updateTrip(UUID tripId, UpdateTripRequest request, UUID userId) {
        log.info("Updating trip: tripId={}, requestedBy={}", tripId, userId);
        Trip trip = findTripOrThrow(tripId);
        ensureOwner(tripId, userId);

        if (request.title() != null) {
            trip.setTitle(request.title());
        }
        if (request.destination() != null) {
            trip.setDestination(request.destination());
        }
        if (request.description() != null) {
            trip.setDescription(request.description());
        }
        if (request.startDate() != null) {
            trip.setStartDate(request.startDate());
        }
        if (request.endDate() != null) {
            trip.setEndDate(request.endDate());
        }
        if (request.startDate() != null || request.endDate() != null) {
            validateDates(trip.getStartDate(), trip.getEndDate());
        }
        if (request.status() != null) {
            trip.setStatus(parseStatus(request.status()));
        }
        if (request.visibility() != null) {
            trip.setVisibility(parseVisibility(request.visibility()));
        }
        if (request.maxParticipants() != null) {
            trip.setMaxParticipants(request.maxParticipants());
        }
        if (request.coverImageUrl() != null) {
            trip.setCoverImageUrl(request.coverImageUrl());
        }

        trip = tripRepository.save(trip);
        log.info("Trip updated: tripId={}, title='{}', updatedBy={}", trip.getId(), trip.getTitle(), userId);
        return toTripResponse(trip);
    }

    /**
     * Trip status lifecycle transition. Restricted to the trip owner.
     *
     * <p>Moves a trip between its lifecycle states
     * ({@code DRAFT → PLANNED → ONGOING → COMPLETED}, or {@code CANCELLED}).
     */
    @Transactional
    public TripResponse updateTripStatus(UUID tripId, String status, UUID userId) {
        log.info("Updating trip status: tripId={}, requestedStatus={}, requestedBy={}",
                tripId, status, userId);
        Trip trip = findTripOrThrow(tripId);
        ensureOwner(tripId, userId);

        TripStatus previous = trip.getStatus();
        TripStatus next = parseStatus(status);
        trip.setStatus(next);
        trip = tripRepository.save(trip);

        log.info("Trip status changed: tripId={}, {} → {}, by={}",
                tripId, previous, next, userId);
        return toTripResponse(trip);
    }

    @Transactional
    public void deleteTrip(UUID tripId, UUID userId) {
        log.info("Deleting (cancelling) trip: tripId={}, requestedBy={}", tripId, userId);
        Trip trip = findTripOrThrow(tripId);
        ensureOwner(tripId, userId);
        trip.setStatus(TripStatus.CANCELLED);
        tripRepository.save(trip);
        log.info("Trip cancelled: tripId={}, title='{}', deletedBy={}", tripId, trip.getTitle(), userId);
    }

    // ── Helpers ──────────────────────────────────────────────────────────

    private Trip findTripOrThrow(UUID tripId) {
        return tripRepository.findById(tripId)
                .orElseThrow(() -> new TripNotFoundException(tripId));
    }

    private void ensureParticipant(UUID tripId, UUID userId) {
        participantRepository.findByTripIdAndUserId(tripId, userId)
                .filter(p -> p.getStatus() == ParticipantStatus.ACCEPTED)
                .orElseThrow(() -> new ForbiddenException(
                        "You are not a participant of this trip"));
    }

    private void ensureOwner(UUID tripId, UUID userId) {
        participantRepository.findByTripIdAndUserId(tripId, userId)
                .filter(p -> p.getRole() == ParticipantRole.OWNER)
                .orElseThrow(() -> new ForbiddenException(
                        "Only the trip owner can perform this action"));
    }

    /**
     * Non-DRAFT trips are readable by anyone (either publicly listed or accessible via direct URL);
     * DRAFT trips are hidden from non-participants.
     */
    private boolean isPubliclyViewable(Trip trip) {
        return trip.getStatus() != TripStatus.DRAFT;
    }

    private void validateDates(java.time.LocalDate startDate, java.time.LocalDate endDate) {
        if (startDate != null && endDate != null && endDate.isBefore(startDate)) {
            throw new InvalidTripDataException("End date must be on or after start date");
        }
    }

    private TripVisibility parseVisibility(String visibility) {
        if (visibility == null) {
            return TripVisibility.PRIVATE;
        }
        try {
            return TripVisibility.valueOf(visibility.toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new InvalidTripDataException("Invalid visibility: " + visibility);
        }
    }

    private TripStatus parseStatus(String status) {
        try {
            return TripStatus.valueOf(status.toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new InvalidTripDataException("Invalid status: " + status);
        }
    }

    /**
     * Publishes a {@code trip.created} event to RabbitMQ so that user-service
     * can upgrade the creator's platform role to HOST.
     */
    private void publishTripCreatedEvent(UUID tripId, UUID createdBy) {
        java.util.Map<String, Object> event = java.util.Map.of(
                "eventType", "trip.created",
                "tripId", tripId.toString(),
                "createdBy", createdBy.toString(),
                "timestamp", java.time.Instant.now().toString()
        );
        try {
            rabbitTemplate.convertAndSend(RabbitMQConfig.TRIP_EXCHANGE, "trip.created", event);
            log.info("Event published: trip.created | tripId={} | owner={} | exchange={}",
                    tripId, createdBy, RabbitMQConfig.TRIP_EXCHANGE);
        } catch (AmqpException ex) {
            log.error("Failed to publish trip.created event for tripId={}", tripId, ex);
        }
    }

    private TripResponse toTripResponse(Trip trip) {
        return toTripResponse(trip, null, 0);
    }

    private TripResponse toTripResponse(Trip trip, String currentUserStatus, int memberCount) {
        return new TripResponse(
                trip.getId(),
                trip.getTitle(),
                trip.getDestination(),
                trip.getDescription(),
                trip.getStartDate(),
                trip.getEndDate(),
                trip.getStatus().name(),
                trip.getVisibility().name(),
                trip.getMaxParticipants(),
                trip.getCoverImageUrl(),
                trip.getCreatedBy(),
                trip.getCreatedAt(),
                trip.getUpdatedAt(),
                currentUserStatus,
                memberCount
        );
    }

    private TripDetailResponse toTripDetailResponse(Trip trip, List<ParticipantResponse> participants) {
        return new TripDetailResponse(
                trip.getId(),
                trip.getTitle(),
                trip.getDestination(),
                trip.getDescription(),
                trip.getStartDate(),
                trip.getEndDate(),
                trip.getStatus().name(),
                trip.getVisibility().name(),
                trip.getMaxParticipants(),
                trip.getCoverImageUrl(),
                trip.getCreatedBy(),
                trip.getCreatedAt(),
                trip.getUpdatedAt(),
                participants
        );
    }

    private ParticipantResponse toParticipantResponse(Participant p) {
        return new ParticipantResponse(
                p.getId(),
                p.getUserId(),
                p.getRole().name(),
                p.getStatus().name(),
                p.getJoinedAt()
        );
    }
}
