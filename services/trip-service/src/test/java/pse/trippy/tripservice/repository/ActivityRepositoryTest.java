package pse.trippy.tripservice.repository;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase.Replace;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.boot.autoconfigure.ImportAutoConfiguration;
import pse.trippy.tripservice.model.entity.Activity;
import pse.trippy.tripservice.model.entity.DayPlan;
import pse.trippy.tripservice.model.entity.Itinerary;
import pse.trippy.tripservice.model.entity.Trip;
import pse.trippy.tripservice.model.enums.ActivityCategory;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Integration tests for {@link ActivityRepository} using an H2 in-memory database.
 */
@DataJpaTest
@ActiveProfiles("test")
@ImportAutoConfiguration(exclude = {
    org.springframework.cloud.openfeign.FeignAutoConfiguration.class
})
@DisplayName("ActivityRepository")
class ActivityRepositoryTest {

    @Autowired
    private ActivityRepository activityRepository;

    @Autowired
    private DayPlanRepository dayPlanRepository;

    @Autowired
    private ItineraryRepository itineraryRepository;

    @Autowired
    private TripRepository tripRepository;

    private DayPlan dayPlan;
    private DayPlan otherDayPlan;

    @BeforeEach
    void setUp() {
        Trip trip = tripRepository.save(Trip.builder()
                .title("Japan Adventure")
                .destination("Tokyo")
                .startDate(LocalDate.of(2026, 4, 1))
                .endDate(LocalDate.of(2026, 4, 14))
                .createdBy(UUID.randomUUID())
                .build());

        Itinerary itinerary = itineraryRepository.save(Itinerary.builder().trip(trip).build());

        dayPlan = dayPlanRepository.save(DayPlan.builder()
                .itinerary(itinerary)
                .dayNumber(1)
                .date(LocalDate.of(2026, 4, 1))
                .title("Day 1 - Arrival")
                .build());

        otherDayPlan = dayPlanRepository.save(DayPlan.builder()
                .itinerary(itinerary)
                .dayNumber(2)
                .date(LocalDate.of(2026, 4, 2))
                .title("Day 2 - Sightseeing")
                .build());

        activityRepository.save(Activity.builder()
                .dayPlan(dayPlan).title("Check in to hotel")
                .description("Hotel check-in process").location("Shinjuku Hotel")
                .category(ActivityCategory.ACCOMMODATION).orderIndex(2).build());
        activityRepository.save(Activity.builder()
                .dayPlan(dayPlan).title("Flight to Tokyo")
                .description("International flight").location("Tokyo Airport")
                .category(ActivityCategory.TRANSPORT).orderIndex(0).build());
        activityRepository.save(Activity.builder()
                .dayPlan(dayPlan).title("Dinner at Ramen shop")
                .description("Enjoy local ramen").location("Ichiran Shinjuku")
                .category(ActivityCategory.FOOD).orderIndex(1).build());

        activityRepository.save(Activity.builder()
                .dayPlan(otherDayPlan).title("Visit Senso-ji Temple")
                .description("Historic Buddhist temple").location("Asakusa")
                .category(ActivityCategory.SIGHTSEEING).orderIndex(0).build());
    }

    @Nested
    @DisplayName("findByDayPlanIdOrderByOrderIndexAsc")
    class FindOrdered {

        @Test
        @DisplayName("returns all activities in order index ascending")
        void returnsActivitiesOrdered() {
            List<Activity> results = activityRepository.findByDayPlanIdOrderByOrderIndexAsc(dayPlan.getId());
            assertThat(results).hasSize(3);
            assertThat(results).extracting(Activity::getOrderIndex).containsExactly(0, 1, 2);
            assertThat(results).extracting(Activity::getTitle)
                    .containsExactly("Flight to Tokyo", "Dinner at Ramen shop", "Check in to hotel");
        }

        @Test
        @DisplayName("returns empty list for a day plan with no activities")
        void returnsEmptyForDayPlanWithNoActivities() {
            Trip otherTrip = tripRepository.save(Trip.builder()
                    .title("Empty Trip").destination("Paris")
                    .startDate(LocalDate.of(2027, 1, 1))
                    .endDate(LocalDate.of(2027, 1, 5))
                    .createdBy(UUID.randomUUID()).build());
            Itinerary emptyItinerary = itineraryRepository.save(
                    Itinerary.builder().trip(otherTrip).build());
            DayPlan emptyDay = dayPlanRepository.save(DayPlan.builder()
                    .itinerary(emptyItinerary).dayNumber(1)
                    .date(LocalDate.of(2027, 1, 1)).build());

            List<Activity> results = activityRepository.findByDayPlanIdOrderByOrderIndexAsc(emptyDay.getId());
            assertThat(results).isEmpty();
        }
    }

    @Nested
    @DisplayName("deleteAllByDayPlanId")
    class DeleteAll {

        @Test
        @DisplayName("removes all activities for the specified day plan")
        void deletesActivitiesForDayPlan() {
            activityRepository.deleteAllByDayPlanId(dayPlan.getId());

            List<Activity> remaining = activityRepository.findByDayPlanIdOrderByOrderIndexAsc(dayPlan.getId());
            assertThat(remaining).isEmpty();
        }

        @Test
        @DisplayName("does not remove activities from other day plans")
        void doesNotAffectOtherDayPlan() {
            activityRepository.deleteAllByDayPlanId(dayPlan.getId());

            List<Activity> otherActivities = activityRepository
                    .findByDayPlanIdOrderByOrderIndexAsc(otherDayPlan.getId());
            assertThat(otherActivities).hasSize(1);
            assertThat(otherActivities.get(0).getTitle()).isEqualTo("Visit Senso-ji Temple");
        }
    }
}
