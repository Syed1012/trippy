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
import pse.trippy.tripservice.model.entity.DayPlan;
import pse.trippy.tripservice.model.entity.Itinerary;
import pse.trippy.tripservice.model.entity.Trip;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Integration tests for {@link DayPlanRepository} using an H2 in-memory database.
 */
@DataJpaTest
@ImportAutoConfiguration(exclude = {
    org.springframework.cloud.openfeign.FeignAutoConfiguration.class
})
@ActiveProfiles("test")
@DisplayName("DayPlanRepository")
class DayPlanRepositoryTest {

    @Autowired
    private DayPlanRepository dayPlanRepository;

    @Autowired
    private ItineraryRepository itineraryRepository;

    @Autowired
    private TripRepository tripRepository;

    private Itinerary itinerary;

    @BeforeEach
    void setUp() {
        Trip trip = tripRepository.save(Trip.builder()
                .title("Thailand Trip")
                .destination("Bangkok")
                .startDate(LocalDate.of(2026, 10, 1))
                .endDate(LocalDate.of(2026, 10, 10))
                .createdBy(UUID.randomUUID())
                .build());

        itinerary = itineraryRepository.save(Itinerary.builder().trip(trip).build());

        dayPlanRepository.save(DayPlan.builder().itinerary(itinerary).dayNumber(1)
                .date(LocalDate.of(2026, 10, 1)).title("Arrival").build());
        dayPlanRepository.save(DayPlan.builder().itinerary(itinerary).dayNumber(3)
                .date(LocalDate.of(2026, 10, 3)).title("Temple Day").build());
        dayPlanRepository.save(DayPlan.builder().itinerary(itinerary).dayNumber(2)
                .date(LocalDate.of(2026, 10, 2)).title("Markets").build());
    }

    @Nested
    @DisplayName("findByItineraryIdOrderByDayNumberAsc")
    class FindOrdered {

        @Test
        @DisplayName("returns all day plans ordered by day number ascending")
        void returnsOrderedDayPlans() {
            List<DayPlan> results = dayPlanRepository.findByItineraryIdOrderByDayNumberAsc(itinerary.getId());
            assertThat(results).hasSize(3);
            assertThat(results).extracting(DayPlan::getDayNumber).containsExactly(1, 2, 3);
        }

        @Test
        @DisplayName("returns empty list for itinerary with no day plans")
        void returnsEmptyForEmptyItinerary() {
            Trip otherTrip = tripRepository.save(Trip.builder()
                    .title("Other Trip")
                    .destination("London")
                    .startDate(LocalDate.of(2026, 11, 1))
                    .endDate(LocalDate.of(2026, 11, 5))
                    .createdBy(UUID.randomUUID())
                    .build());
            Itinerary emptyItinerary = itineraryRepository.save(Itinerary.builder().trip(otherTrip).build());

            List<DayPlan> results = dayPlanRepository.findByItineraryIdOrderByDayNumberAsc(emptyItinerary.getId());
            assertThat(results).isEmpty();
        }
    }

    @Nested
    @DisplayName("findByItineraryIdAndDayNumber")
    class FindByDayNumber {

        @Test
        @DisplayName("returns day plan for the specified day number")
        void returnsDayPlanForDayNumber() {
            Optional<DayPlan> result = dayPlanRepository.findByItineraryIdAndDayNumber(itinerary.getId(), 2);
            assertThat(result).isPresent();
            assertThat(result.get().getTitle()).isEqualTo("Markets");
        }

        @Test
        @DisplayName("returns empty for a day number that does not exist")
        void returnsEmptyForNonExistentDayNumber() {
            Optional<DayPlan> result = dayPlanRepository.findByItineraryIdAndDayNumber(itinerary.getId(), 99);
            assertThat(result).isEmpty();
        }
    }
}
