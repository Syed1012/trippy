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
import pse.trippy.tripservice.model.entity.Itinerary;
import pse.trippy.tripservice.model.entity.Trip;

import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Integration tests for {@link ItineraryRepository} using an H2 in-memory database.
 */
@DataJpaTest
@ImportAutoConfiguration(exclude = {
    org.springframework.cloud.openfeign.FeignAutoConfiguration.class
})
@ActiveProfiles("test")
@DisplayName("ItineraryRepository")
class ItineraryRepositoryTest {

    @Autowired
    private ItineraryRepository itineraryRepository;

    @Autowired
    private TripRepository tripRepository;

    private Trip trip;
    private Itinerary itinerary;

    private Trip savedTrip(String title) {
        return tripRepository.save(Trip.builder()
                .title(title)
                .destination("Tokyo")
                .startDate(LocalDate.of(2026, 9, 1))
                .endDate(LocalDate.of(2026, 9, 14))
                .createdBy(UUID.randomUUID())
                .build());
    }

    @BeforeEach
    void setUp() {
        trip = savedTrip("Japan Adventure");
        itinerary = itineraryRepository.save(Itinerary.builder().trip(trip).build());
    }

    @Nested
    @DisplayName("findByTripId")
    class FindByTripId {

        @Test
        @DisplayName("returns itinerary for a trip that has one")
        void returnsItineraryForTrip() {
            Optional<Itinerary> result = itineraryRepository.findByTripId(trip.getId());
            assertThat(result).isPresent();
            assertThat(result.get().getId()).isEqualTo(itinerary.getId());
        }

        @Test
        @DisplayName("returns empty when trip has no itinerary")
        void returnsEmptyForTripWithNoItinerary() {
            Trip emptyTrip = savedTrip("Itinerary-less Trip");
            Optional<Itinerary> result = itineraryRepository.findByTripId(emptyTrip.getId());
            assertThat(result).isEmpty();
        }

        @Test
        @DisplayName("returns empty for unknown trip ID")
        void returnsEmptyForUnknownTripId() {
            Optional<Itinerary> result = itineraryRepository.findByTripId(UUID.randomUUID());
            assertThat(result).isEmpty();
        }
    }
}
