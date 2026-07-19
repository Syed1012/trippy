package pse.trippy.tripservice.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.ImportAutoConfiguration;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;
import org.springframework.test.context.ActiveProfiles;
import pse.trippy.tripservice.dto.request.ActivityRequest;
import pse.trippy.tripservice.dto.request.DayPlanRequest;
import pse.trippy.tripservice.dto.request.UpdateItineraryRequest;
import pse.trippy.tripservice.dto.response.ItineraryResponse;
import pse.trippy.tripservice.model.entity.Activity;
import pse.trippy.tripservice.model.entity.ActivityComment;
import pse.trippy.tripservice.model.entity.ActivityVote;
import pse.trippy.tripservice.model.entity.DayPlan;
import pse.trippy.tripservice.model.entity.Itinerary;
import pse.trippy.tripservice.model.entity.Participant;
import pse.trippy.tripservice.model.entity.Trip;
import pse.trippy.tripservice.model.enums.ActivityCategory;
import pse.trippy.tripservice.model.enums.ParticipantRole;
import pse.trippy.tripservice.model.enums.ParticipantStatus;
import pse.trippy.tripservice.model.enums.VoteType;
import pse.trippy.tripservice.repository.ActivityCommentRepository;
import pse.trippy.tripservice.repository.ActivityRepository;
import pse.trippy.tripservice.repository.ActivityVoteRepository;
import pse.trippy.tripservice.repository.DayPlanRepository;
import pse.trippy.tripservice.repository.DayPlanVoteRepository;
import pse.trippy.tripservice.repository.ItineraryRepository;
import pse.trippy.tripservice.repository.ParticipantRepository;
import pse.trippy.tripservice.repository.TripRepository;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;

/**
 * Real-database regression coverage for {@link ItineraryService#updateItinerary}.
 *
 * <p>Unlike {@link ItineraryServiceTest} (Mockito, no real constraints), this runs
 * against an H2 schema generated from the JPA entities — including the
 * {@code fk_activity_comments_activity} / {@code fk_activity_votes_activity}
 * foreign keys — so it reproduces the exact bug reported in production: replacing
 * an itinerary whose activities have comments/votes used to throw
 * {@code DataIntegrityViolationException} because those child rows were never
 * deleted before their parent activity.
 */
@DataJpaTest
@ActiveProfiles("test")
@ImportAutoConfiguration(exclude = {
    org.springframework.cloud.openfeign.FeignAutoConfiguration.class
})
@DisplayName("ItineraryService.updateItinerary (real DB, FK-constrained)")
class ItineraryServiceIntegrationTest {

    @Autowired
    private TripRepository tripRepository;
    @Autowired
    private ItineraryRepository itineraryRepository;
    @Autowired
    private DayPlanRepository dayPlanRepository;
    @Autowired
    private ActivityRepository activityRepository;
    @Autowired
    private DayPlanVoteRepository dayPlanVoteRepository;
    @Autowired
    private ActivityVoteRepository activityVoteRepository;
    @Autowired
    private ActivityCommentRepository activityCommentRepository;
    @Autowired
    private ParticipantRepository participantRepository;
    @Autowired
    private TestEntityManager entityManager;

    private ItineraryService itineraryService;

    private UUID tripId;
    private UUID userId;
    private UUID staleActivityId;

    @BeforeEach
    void setUp() {
        itineraryService = new ItineraryService(
                tripRepository, itineraryRepository, dayPlanRepository, activityRepository,
                dayPlanVoteRepository, activityVoteRepository, activityCommentRepository,
                participantRepository);

        userId = UUID.randomUUID();

        Trip trip = tripRepository.save(Trip.builder()
                .title("Barcelona Trip")
                .destination("Barcelona")
                .startDate(LocalDate.of(2026, 7, 1))
                .endDate(LocalDate.of(2026, 7, 7))
                .createdBy(userId)
                .build());
        tripId = trip.getId();

        Participant owner = Participant.builder()
                .trip(trip)
                .userId(userId)
                .role(ParticipantRole.OWNER)
                .status(ParticipantStatus.ACCEPTED)
                .joinedAt(Instant.now())
                .build();
        participantRepository.save(owner);

        Itinerary itinerary = itineraryRepository.save(Itinerary.builder().trip(trip).build());

        DayPlan dayPlan = dayPlanRepository.save(DayPlan.builder()
                .itinerary(itinerary)
                .dayNumber(1)
                .date(LocalDate.of(2026, 7, 1))
                .title("Arrival Day")
                .build());

        Activity activity = activityRepository.save(Activity.builder()
                .dayPlan(dayPlan)
                .title("Walk La Rambla")
                .location("La Rambla, Barcelona")
                .startTime(LocalTime.of(16, 0))
                .endTime(LocalTime.of(18, 0))
                .category(ActivityCategory.SIGHTSEEING)
                .orderIndex(0)
                .build());
        staleActivityId = activity.getId();

        // The exact preconditions from the reported bug: a comment AND a vote
        // referencing the activity that is about to be replaced.
        activityCommentRepository.save(ActivityComment.builder()
                .activity(activity)
                .userId(userId)
                .content("Can't wait for this!")
                .build());
        activityVoteRepository.save(ActivityVote.builder()
                .activity(activity)
                .userId(userId)
                .voteType(VoteType.UPVOTE)
                .build());

        // Flush the fixture to the DB and detach it from the persistence context.
        // Without this, setUp() and the test method share one Hibernate session,
        // so the freshly-built `activity` stays cached as a managed entity — an
        // artifact @DataJpaTest introduces that a real request never has (each
        // HTTP request gets its own fresh session). Clearing here makes
        // updateItinerary() start from a clean session, exactly as it does in
        // production.
        entityManager.flush();
        entityManager.clear();
    }

    private UpdateItineraryRequest replacementRequest() {
        ActivityRequest newActivity = new ActivityRequest(
                "Sagrada Familia tour", "Guided tour", "Sagrada Familia, Barcelona",
                LocalTime.of(10, 0), LocalTime.of(12, 0), "SIGHTSEEING", null,
                new java.math.BigDecimal("35.00"), "EUR");
        DayPlanRequest newDay = new DayPlanRequest(
                1, LocalDate.of(2026, 7, 1), "Arrival Day", List.of(newActivity));
        return new UpdateItineraryRequest(List.of(newDay));
    }

    @Test
    @DisplayName("replaces an itinerary whose activities have comments and votes without a FK violation")
    void replacesItineraryWithCommentedAndVotedActivities() {
        assertThatCode(() -> itineraryService.updateItinerary(tripId, replacementRequest(), userId))
                .doesNotThrowAnyException();
    }

    @Test
    @DisplayName("the stale activity's comment and vote are actually gone after the replace")
    void staleCommentAndVoteAreRemoved() {
        itineraryService.updateItinerary(tripId, replacementRequest(), userId);

        assertThat(activityCommentRepository.findByActivityIdOrderByCreatedAtAsc(staleActivityId)).isEmpty();
        assertThat(activityVoteRepository.findByActivityId(staleActivityId)).isEmpty();
        assertThat(activityRepository.findById(staleActivityId)).isEmpty();
    }

    @Test
    @DisplayName("the new itinerary content is persisted correctly after the replace")
    void newContentIsPersisted() {
        ItineraryResponse response = itineraryService.updateItinerary(tripId, replacementRequest(), userId);

        assertThat(response.dayPlans()).hasSize(1);
        assertThat(response.dayPlans().get(0).activities()).hasSize(1);
        assertThat(response.dayPlans().get(0).activities().get(0).title())
                .isEqualTo("Sagrada Familia tour");
        assertThat(response.dayPlans().get(0).activities().get(0).estimatedCost())
                .isEqualByComparingTo("35.00");
    }
}
