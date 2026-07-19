package pse.trippy.tripservice.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pse.trippy.tripservice.dto.request.ActivityRequest;
import pse.trippy.tripservice.dto.request.DayPlanRequest;
import pse.trippy.tripservice.dto.request.UpdateItineraryRequest;
import pse.trippy.tripservice.dto.response.ActivityResponse;
import pse.trippy.tripservice.dto.response.DayPlanResponse;
import pse.trippy.tripservice.dto.response.ItineraryResponse;
import pse.trippy.tripservice.exception.ForbiddenException;
import pse.trippy.tripservice.exception.InvalidTripDataException;
import pse.trippy.tripservice.exception.TripNotFoundException;
import pse.trippy.tripservice.model.entity.Activity;
import pse.trippy.tripservice.model.entity.DayPlan;
import pse.trippy.tripservice.model.entity.Itinerary;
import pse.trippy.tripservice.model.entity.Trip;
import pse.trippy.tripservice.model.enums.ActivityCategory;
import pse.trippy.tripservice.model.enums.ParticipantRole;
import pse.trippy.tripservice.model.enums.ParticipantStatus;
import pse.trippy.tripservice.model.enums.TripStatus;
import pse.trippy.tripservice.model.enums.TripVisibility;
import pse.trippy.tripservice.model.enums.VoteType;
import pse.trippy.tripservice.repository.ActivityCommentRepository;
import pse.trippy.tripservice.repository.ActivityRepository;
import pse.trippy.tripservice.repository.ActivityVoteRepository;
import pse.trippy.tripservice.repository.DayPlanRepository;
import pse.trippy.tripservice.repository.DayPlanVoteRepository;
import pse.trippy.tripservice.repository.ItineraryRepository;
import pse.trippy.tripservice.repository.ParticipantRepository;
import pse.trippy.tripservice.repository.TripRepository;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ItineraryService {

    private final TripRepository tripRepository;
    private final ItineraryRepository itineraryRepository;
    private final DayPlanRepository dayPlanRepository;
    private final ActivityRepository activityRepository;
    private final DayPlanVoteRepository dayPlanVoteRepository;
    private final ActivityVoteRepository activityVoteRepository;
    private final ActivityCommentRepository activityCommentRepository;
    private final ParticipantRepository participantRepository;

    @Transactional(readOnly = true)
    public ItineraryResponse getItinerary(UUID tripId, UUID userId) {
        Trip trip = findTripOrThrow(tripId);

        // Public read access only for published (non-DRAFT) public trips;
        // everything else requires participation. DRAFT trips stay private to members.
        if (!isPubliclyViewable(trip)) {
            ensureParticipant(tripId, userId);
        }

        return itineraryRepository.findByTripId(tripId)
                .map(it -> toItineraryResponse(it, userId))
                .orElseGet(() -> new ItineraryResponse(
                        tripId, Collections.emptyList(), null, null));
    }

    @Transactional(readOnly = true)
    public ItineraryResponse getSharedItinerary(UUID tripId) {
        Trip trip = findTripOrThrow(tripId);
        if (!isPubliclyViewable(trip)) {
            throw new ForbiddenException("This itinerary is not publicly viewable");
        }

        return itineraryRepository.findByTripId(tripId)
                .map(it -> toItineraryResponse(it, null))
                .orElseGet(() -> new ItineraryResponse(
                        tripId, Collections.emptyList(), null, null));
    }

    @Transactional
    public ItineraryResponse updateItinerary(UUID tripId, UpdateItineraryRequest request, UUID userId) {
        Trip trip = findTripOrThrow(tripId);
        // All accepted participants can contribute to the itinerary
        ensureParticipant(tripId, userId);

        // Find or create itinerary
        Itinerary itinerary = itineraryRepository.findByTripId(tripId)
                .orElseGet(() -> {
                    Itinerary newItinerary = Itinerary.builder()
                            .trip(trip)
                            .build();
                    return itineraryRepository.save(newItinerary);
                });

        // Delete existing day plans and everything that references their activities
        // (full replace). Order matters: activity_comments and activity_votes hold a
        // FK to activities, so they must be purged before the activities themselves,
        // which in turn must go before their day plans.
        List<DayPlan> existingDayPlans = dayPlanRepository
                .findByItineraryIdOrderByDayNumberAsc(itinerary.getId());
        for (DayPlan dp : existingDayPlans) {
            activityCommentRepository.deleteAllByDayPlanId(dp.getId());
            activityVoteRepository.deleteAllByDayPlanId(dp.getId());
            dayPlanVoteRepository.deleteAllByDayPlanId(dp.getId());
            activityRepository.deleteAllByDayPlanId(dp.getId());
        }
        dayPlanRepository.deleteAll(existingDayPlans);

        // Create new day plans and activities
        List<DayPlan> savedDayPlans = new ArrayList<>();
        for (DayPlanRequest dpReq : request.dayPlans()) {
            DayPlan dayPlan = DayPlan.builder()
                    .itinerary(itinerary)
                    .dayNumber(dpReq.dayNumber())
                    .date(dpReq.date())
                    .title(dpReq.title())
                    .build();
            dayPlan = dayPlanRepository.save(dayPlan);

            List<Activity> savedActivities = new ArrayList<>();
            for (int i = 0; i < dpReq.activities().size(); i++) {
                ActivityRequest actReq = dpReq.activities().get(i);
                Activity activity = Activity.builder()
                        .dayPlan(dayPlan)
                        .title(actReq.title())
                        .description(actReq.description())
                        .location(actReq.location())
                        .startTime(actReq.startTime())
                        .endTime(actReq.endTime())
                        .category(parseCategory(actReq.category()))
                        .notes(actReq.notes())
                        .estimatedCost(actReq.estimatedCost())
                        .currency(actReq.currency())
                        .orderIndex(i)
                        .build();
                savedActivities.add(activityRepository.save(activity));
            }
            savedDayPlans.add(dayPlan);
        }

        // Touch itinerary to update updatedAt
        itinerary = itineraryRepository.save(itinerary);

        // A trip stays DRAFT until its itinerary is substantial enough to publish.
        reevaluateTripStatus(trip, request);

        return toItineraryResponse(itinerary, userId);
    }

    // ── Helpers ──────────────────────────────────────────────────────────

    /**
     * A trip is "publish-worthy" (moves from DRAFT to PLANNED) once its
     * itinerary has real substance: at least two days each with an activity,
     * or a single day with more than one activity. Anything less keeps it a
     * DRAFT, which stays hidden from other platform users.
     */
    private static boolean qualifiesForActive(UpdateItineraryRequest request) {
        int daysWithActivities = 0;
        boolean anyDayHasMultiple = false;
        for (DayPlanRequest day : request.dayPlans()) {
            long activityCount = day.activities() == null ? 0 : day.activities().stream()
                    .filter(a -> a.title() != null && !a.title().isBlank())
                    .count();
            if (activityCount >= 1) {
                daysWithActivities++;
            }
            if (activityCount >= 2) {
                anyDayHasMultiple = true;
            }
        }
        return daysWithActivities >= 2 || anyDayHasMultiple;
    }

    /**
     * Auto-manages only the DRAFT ⇄ PLANNED transition based on the itinerary.
     * Deliberate later states (ONGOING / COMPLETED / CANCELLED) are left untouched.
     */
    private void reevaluateTripStatus(Trip trip, UpdateItineraryRequest request) {
        TripStatus current = trip.getStatus();
        if (current != TripStatus.DRAFT && current != TripStatus.PLANNED) {
            return;
        }
        TripStatus target = qualifiesForActive(request) ? TripStatus.PLANNED : TripStatus.DRAFT;
        if (current != target) {
            trip.setStatus(target);
            tripRepository.save(trip);
        }
    }

    /** Non-DRAFT trips are readable by anyone (either publicly listed or accessible via direct URL); DRAFT trips never are. */
    private boolean isPubliclyViewable(Trip trip) {
        return trip.getStatus() != TripStatus.DRAFT;
    }

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

    private void ensureOwnerOrEditor(UUID tripId, UUID userId) {
        participantRepository.findByTripIdAndUserId(tripId, userId)
                .filter(p -> p.getStatus() == ParticipantStatus.ACCEPTED)
                .filter(p -> p.getRole() == ParticipantRole.OWNER
                        || p.getRole() == ParticipantRole.EDITOR)
                .orElseThrow(() -> new ForbiddenException(
                        "Only the trip owner or editor can modify the itinerary"));
    }

    private ActivityCategory parseCategory(String category) {
        if (category == null) {
            return ActivityCategory.OTHER;
        }
        String normalized = category.toUpperCase();
        // Map common frontend aliases
        if ("DEFAULT".equals(normalized) || "MORNING".equals(normalized)
                || "EVENING".equals(normalized) || "BREAKFAST".equals(normalized)
                || "LUNCH".equals(normalized) || "DINNER".equals(normalized)) {
            return ActivityCategory.OTHER;
        }
        try {
            return ActivityCategory.valueOf(normalized);
        } catch (IllegalArgumentException e) {
            return ActivityCategory.OTHER;
        }
    }

    private ItineraryResponse toItineraryResponse(Itinerary itinerary, UUID userId) {
        List<DayPlan> dayPlans = dayPlanRepository
                .findByItineraryIdOrderByDayNumberAsc(itinerary.getId());

        List<DayPlanResponse> dayPlanResponses = dayPlans.stream()
                .map(dp -> toDayPlanResponse(dp, userId))
                .toList();

        return new ItineraryResponse(
                itinerary.getTrip().getId(),
                dayPlanResponses,
                itinerary.getCreatedAt(),
                itinerary.getUpdatedAt()
        );
    }

    private DayPlanResponse toDayPlanResponse(DayPlan dayPlan, UUID userId) {
        List<Activity> activities = activityRepository
                .findByDayPlanIdOrderByOrderIndexAsc(dayPlan.getId());

        List<ActivityResponse> activityResponses = activities.stream()
                .map(a -> toActivityResponse(a, userId))
                .toList();

        long upvotes = dayPlanVoteRepository.countByDayPlanIdAndVoteType(dayPlan.getId(), VoteType.UPVOTE);
        long downvotes = dayPlanVoteRepository.countByDayPlanIdAndVoteType(dayPlan.getId(), VoteType.DOWNVOTE);
        String currentUserVote = userId == null
                ? null
                : dayPlanVoteRepository.findByDayPlanIdAndUserId(dayPlan.getId(), userId)
                .map(v -> v.getVoteType().name())
                .orElse(null);

        return new DayPlanResponse(
                dayPlan.getId(),
                dayPlan.getDayNumber(),
                dayPlan.getDate(),
                dayPlan.getTitle(),
                activityResponses,
                dayPlan.isVotingEnabled(),
                dayPlan.isVotingFrozen(),
                dayPlan.getVotingDeadline(),
                upvotes,
                downvotes,
                currentUserVote
        );
    }

    private ActivityResponse toActivityResponse(Activity activity, UUID userId) {
        long upvotes = activityVoteRepository.countByActivityIdAndVoteType(activity.getId(), VoteType.UPVOTE);
        long downvotes = activityVoteRepository.countByActivityIdAndVoteType(activity.getId(), VoteType.DOWNVOTE);
        String currentUserVote = userId == null
                ? null
                : activityVoteRepository.findByActivityIdAndUserId(activity.getId(), userId)
                .map(v -> v.getVoteType().name())
                .orElse(null);

        return new ActivityResponse(
                activity.getId(),
                activity.getTitle(),
                activity.getDescription(),
                activity.getLocation(),
                activity.getStartTime(),
                activity.getEndTime(),
                activity.getCategory().name(),
                activity.getNotes(),
                activity.getEstimatedCost(),
                activity.getCurrency(),
                activity.getOrderIndex(),
                upvotes,
                downvotes,
                currentUserVote
        );
    }
}
