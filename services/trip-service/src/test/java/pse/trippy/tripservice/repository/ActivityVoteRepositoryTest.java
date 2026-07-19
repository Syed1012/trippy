package pse.trippy.tripservice.repository;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.ImportAutoConfiguration;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.test.context.ActiveProfiles;
import pse.trippy.tripservice.model.entity.Activity;
import pse.trippy.tripservice.model.entity.ActivityVote;
import pse.trippy.tripservice.model.entity.DayPlan;
import pse.trippy.tripservice.model.entity.Itinerary;
import pse.trippy.tripservice.model.entity.Trip;
import pse.trippy.tripservice.model.enums.ActivityCategory;
import pse.trippy.tripservice.model.enums.VoteType;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Integration tests for {@link ActivityVoteRepository} using an H2 in-memory database.
 */
@DataJpaTest
@ActiveProfiles("test")
@ImportAutoConfiguration(exclude = {
    org.springframework.cloud.openfeign.FeignAutoConfiguration.class
})
@DisplayName("ActivityVoteRepository")
class ActivityVoteRepositoryTest {

    @Autowired
    private ActivityVoteRepository activityVoteRepository;
    @Autowired
    private ActivityRepository activityRepository;
    @Autowired
    private DayPlanRepository dayPlanRepository;
    @Autowired
    private ItineraryRepository itineraryRepository;
    @Autowired
    private TripRepository tripRepository;

    private Activity activityInDayPlan;
    private Activity otherActivityInDayPlan;
    private Activity activityInOtherDayPlan;

    @BeforeEach
    void setUp() {
        Trip trip = tripRepository.save(Trip.builder()
                .title("Barcelona Trip")
                .destination("Barcelona")
                .startDate(LocalDate.of(2026, 7, 1))
                .endDate(LocalDate.of(2026, 7, 7))
                .createdBy(UUID.randomUUID())
                .build());

        Itinerary itinerary = itineraryRepository.save(Itinerary.builder().trip(trip).build());

        DayPlan dayPlan = dayPlanRepository.save(DayPlan.builder()
                .itinerary(itinerary).dayNumber(1).date(LocalDate.of(2026, 7, 1)).build());
        DayPlan otherDayPlan = dayPlanRepository.save(DayPlan.builder()
                .itinerary(itinerary).dayNumber(2).date(LocalDate.of(2026, 7, 2)).build());

        activityInDayPlan = activityRepository.save(Activity.builder()
                .dayPlan(dayPlan).title("Walk La Rambla")
                .category(ActivityCategory.SIGHTSEEING).orderIndex(0).build());
        otherActivityInDayPlan = activityRepository.save(Activity.builder()
                .dayPlan(dayPlan).title("Sagrada Familia")
                .category(ActivityCategory.SIGHTSEEING).orderIndex(1).build());
        activityInOtherDayPlan = activityRepository.save(Activity.builder()
                .dayPlan(otherDayPlan).title("Park Guell")
                .category(ActivityCategory.SIGHTSEEING).orderIndex(0).build());

        activityVoteRepository.save(ActivityVote.builder()
                .activity(activityInDayPlan).userId(UUID.randomUUID()).voteType(VoteType.UPVOTE).build());
        activityVoteRepository.save(ActivityVote.builder()
                .activity(otherActivityInDayPlan).userId(UUID.randomUUID()).voteType(VoteType.DOWNVOTE).build());
        activityVoteRepository.save(ActivityVote.builder()
                .activity(activityInOtherDayPlan).userId(UUID.randomUUID()).voteType(VoteType.UPVOTE).build());
    }

    @Nested
    @DisplayName("deleteAllByDayPlanId")
    class DeleteAllByDayPlanId {

        @Test
        @DisplayName("removes votes on every activity within the given day plan")
        void deletesVotesForDayPlan() {
            activityVoteRepository.deleteAllByDayPlanId(activityInDayPlan.getDayPlan().getId());

            assertThat(activityVoteRepository.findByActivityId(activityInDayPlan.getId())).isEmpty();
            assertThat(activityVoteRepository.findByActivityId(otherActivityInDayPlan.getId())).isEmpty();
        }

        @Test
        @DisplayName("does not remove votes belonging to another day plan")
        void doesNotAffectOtherDayPlan() {
            activityVoteRepository.deleteAllByDayPlanId(activityInDayPlan.getDayPlan().getId());

            List<ActivityVote> remaining = activityVoteRepository.findByActivityId(activityInOtherDayPlan.getId());
            assertThat(remaining).hasSize(1);
            assertThat(remaining.get(0).getVoteType()).isEqualTo(VoteType.UPVOTE);
        }

        @Test
        @DisplayName("lets the now-unvoted activities be deleted without a FK violation")
        void unblocksActivityDeletion() {
            UUID dayPlanId = activityInDayPlan.getDayPlan().getId();
            activityVoteRepository.deleteAllByDayPlanId(dayPlanId);

            activityRepository.deleteAllByDayPlanId(dayPlanId);

            assertThat(activityRepository.findByDayPlanIdOrderByOrderIndexAsc(dayPlanId)).isEmpty();
        }
    }
}
