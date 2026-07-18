package pse.trippy.tripservice.repository;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase.Replace;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.test.context.ActiveProfiles;
import pse.trippy.tripservice.model.entity.Trip;
import pse.trippy.tripservice.model.enums.TripStatus;
import pse.trippy.tripservice.model.enums.TripVisibility;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Integration tests for {@link TripRepository} using an H2 in-memory database.
 */
@DataJpaTest
@AutoConfigureTestDatabase(replace = Replace.NONE)
@ActiveProfiles("test")
@DisplayName("TripRepository")
class TripRepositoryTest {

    @Autowired
    private TripRepository tripRepository;

    private static final UUID CREATOR_A = UUID.randomUUID();
    private static final UUID CREATOR_B = UUID.randomUUID();

    private Trip draftPrivateTrip;
    private Trip plannedPublicTrip;

    private Trip buildTrip(String title, UUID createdBy, TripStatus status, TripVisibility visibility) {
        return Trip.builder()
                .title(title)
                .destination("Anywhere")
                .startDate(LocalDate.of(2026, 6, 1))
                .endDate(LocalDate.of(2026, 6, 10))
                .createdBy(createdBy)
                .status(status)
                .visibility(visibility)
                .build();
    }

    @BeforeEach
    void setUp() {
        draftPrivateTrip = tripRepository.save(
                buildTrip("Creator A Draft", CREATOR_A, TripStatus.DRAFT, TripVisibility.PRIVATE));

        plannedPublicTrip = tripRepository.save(
                buildTrip("Creator A Public", CREATOR_A, TripStatus.PLANNED, TripVisibility.PUBLIC));

        tripRepository.save(
                buildTrip("Creator B Trip", CREATOR_B, TripStatus.ONGOING, TripVisibility.UNLISTED));
    }

    // =========================================================================
    // findByCreatedBy
    // =========================================================================

    @Nested
    @DisplayName("findByCreatedBy")
    class FindByCreatedBy {

        @Test
        @DisplayName("returns trips owned by the given creator")
        void returnsTripsByCreator() {
            List<Trip> results = tripRepository.findByCreatedBy(CREATOR_A);
            assertThat(results).hasSize(2);
            assertThat(results).extracting(Trip::getTitle)
                    .containsExactlyInAnyOrder("Creator A Draft", "Creator A Public");
        }

        @Test
        @DisplayName("returns empty list for unknown creator")
        void returnsEmptyForUnknownCreator() {
            List<Trip> results = tripRepository.findByCreatedBy(UUID.randomUUID());
            assertThat(results).isEmpty();
        }
    }

    // =========================================================================
    // findByStatus
    // =========================================================================

    @Nested
    @DisplayName("findByStatus")
    class FindByStatus {

        @Test
        @DisplayName("returns trips with DRAFT status")
        void returnsDraftTrips() {
            List<Trip> results = tripRepository.findByStatus(TripStatus.DRAFT);
            assertThat(results).hasSize(1);
            assertThat(results.get(0).getTitle()).isEqualTo("Creator A Draft");
        }

        @Test
        @DisplayName("returns empty list when no trips have the given status")
        void returnsEmptyForUnmatchedStatus() {
            List<Trip> results = tripRepository.findByStatus(TripStatus.CANCELLED);
            assertThat(results).isEmpty();
        }
    }

    // =========================================================================
    // findByVisibility
    // =========================================================================

    @Nested
    @DisplayName("findByVisibility")
    class FindByVisibility {

        @Test
        @DisplayName("returns all PUBLIC trips for the discovery feed")
        void returnsPublicTrips() {
            List<Trip> results = tripRepository.findByVisibility(TripVisibility.PUBLIC);
            assertThat(results).hasSize(1);
            assertThat(results.get(0).getTitle()).isEqualTo("Creator A Public");
        }

        @Test
        @DisplayName("returns empty list when no trips are UNLISTED")
        void returnsUnlistedTrips() {
            List<Trip> results = tripRepository.findByVisibility(TripVisibility.UNLISTED);
            assertThat(results).hasSize(1);
        }
    }

    // =========================================================================
    // findByCreatedByAndStatus
    // =========================================================================

    @Nested
    @DisplayName("findByCreatedByAndStatus")
    class FindByCreatedByAndStatus {

        @Test
        @DisplayName("returns trips matching both creator and status")
        void returnsTripsByCreatorAndStatus() {
            List<Trip> results = tripRepository.findByCreatedByAndStatus(CREATOR_A, TripStatus.PLANNED);
            assertThat(results).hasSize(1);
            assertThat(results.get(0).getTitle()).isEqualTo("Creator A Public");
        }

        @Test
        @DisplayName("returns empty when creator has no trips with the given status")
        void returnsEmptyForNonMatchingStatus() {
            List<Trip> results = tripRepository.findByCreatedByAndStatus(CREATOR_A, TripStatus.COMPLETED);
            assertThat(results).isEmpty();
        }
    }

    // =========================================================================
    // findPublicTripsExcludingUser (discovery feed)
    // =========================================================================

    @Nested
    @DisplayName("findPublicTripsExcludingUser")
    class FindPublicTripsExcludingUser {

        @Test
        @DisplayName("returns published (non-DRAFT) public trips")
        void returnsPublishedPublicTrips() {
            Page<Trip> results = tripRepository.findPublicTripsExcludingUser(
                    UUID.randomUUID(), PageRequest.of(0, 10));
            assertThat(results.getContent()).extracting(Trip::getTitle)
                    .containsExactly("Creator A Public");
        }

        @Test
        @DisplayName("excludes DRAFT trips from the discovery feed even when PUBLIC")
        void excludesDraftPublicTrips() {
            tripRepository.save(
                    buildTrip("Draft Public", CREATOR_B, TripStatus.DRAFT, TripVisibility.PUBLIC));

            Page<Trip> results = tripRepository.findPublicTripsExcludingUser(
                    UUID.randomUUID(), PageRequest.of(0, 10));

            assertThat(results.getContent()).extracting(Trip::getTitle)
                    .contains("Creator A Public")
                    .doesNotContain("Draft Public");
        }
    }

    @Test
    @DisplayName("findPublicTrips returns published public trips for anonymous visitors")
    void findPublicTripsReturnsPublishedPublicTrips() {
        tripRepository.save(buildTrip("Draft Public", CREATOR_B, TripStatus.DRAFT, TripVisibility.PUBLIC));

        Page<Trip> results = tripRepository.findPublicTrips(PageRequest.of(0, 10));

        assertThat(results.getContent()).extracting(Trip::getTitle)
                .containsExactly("Creator A Public");
    }
}
