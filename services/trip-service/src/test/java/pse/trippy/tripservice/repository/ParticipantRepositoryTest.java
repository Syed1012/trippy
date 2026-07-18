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
import pse.trippy.tripservice.model.entity.Participant;
import pse.trippy.tripservice.model.entity.Trip;
import pse.trippy.tripservice.model.enums.ParticipantRole;
import pse.trippy.tripservice.model.enums.ParticipantStatus;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Integration tests for {@link ParticipantRepository} using an H2 in-memory database.
 */
@DataJpaTest
@ImportAutoConfiguration(exclude = {
    org.springframework.cloud.openfeign.FeignAutoConfiguration.class
})
@ActiveProfiles("test")
@DisplayName("ParticipantRepository")
class ParticipantRepositoryTest {

    @Autowired
    private ParticipantRepository participantRepository;

    @Autowired
    private TripRepository tripRepository;

    private static final UUID USER_ALICE = UUID.randomUUID();
    private static final UUID USER_BOB = UUID.randomUUID();

    private Trip trip;
    private Participant aliceParticipant;

    private Trip savedTrip() {
        return tripRepository.save(Trip.builder()
                .title("Test Trip")
                .destination("Madrid")
                .startDate(LocalDate.of(2026, 7, 1))
                .endDate(LocalDate.of(2026, 7, 7))
                .createdBy(UUID.randomUUID())
                .build());
    }

    @BeforeEach
    void setUp() {
        trip = savedTrip();

        aliceParticipant = participantRepository.save(Participant.builder()
                .trip(trip)
                .userId(USER_ALICE)
                .role(ParticipantRole.OWNER)
                .status(ParticipantStatus.ACCEPTED)
                .build());
    }

    // =========================================================================
    // findByTripId
    // =========================================================================

    @Nested
    @DisplayName("findByTripId")
    class FindByTripId {

        @Test
        @DisplayName("returns all participants for the given trip")
        void returnsParticipantsForTrip() {
            participantRepository.save(Participant.builder()
                    .trip(trip)
                    .userId(USER_BOB)
                    .role(ParticipantRole.VIEWER)
                    .status(ParticipantStatus.PENDING)
                    .build());

            List<Participant> results = participantRepository.findByTripId(trip.getId());
            assertThat(results).hasSize(2);
            assertThat(results).extracting(Participant::getUserId)
                    .containsExactlyInAnyOrder(USER_ALICE, USER_BOB);
        }

        @Test
        @DisplayName("returns empty list when trip has no participants")
        void returnsEmptyForTripWithNoParticipants() {
            Trip emptyTrip = savedTrip();
            List<Participant> results = participantRepository.findByTripId(emptyTrip.getId());
            assertThat(results).isEmpty();
        }
    }

    // =========================================================================
    // findByUserId
    // =========================================================================

    @Nested
    @DisplayName("findByUserId")
    class FindByUserId {

        @Test
        @DisplayName("returns participant records for the given user")
        void returnsParticipantRecordsForUser() {
            List<Participant> results = participantRepository.findByUserId(USER_ALICE);
            assertThat(results).hasSize(1);
            assertThat(results.get(0).getRole()).isEqualTo(ParticipantRole.OWNER);
        }

        @Test
        @DisplayName("returns empty list for unknown user")
        void returnsEmptyForUnknownUser() {
            List<Participant> results = participantRepository.findByUserId(UUID.randomUUID());
            assertThat(results).isEmpty();
        }
    }

    // =========================================================================
    // findByTripIdAndUserId
    // =========================================================================

    @Nested
    @DisplayName("findByTripIdAndUserId")
    class FindByTripIdAndUserId {

        @Test
        @DisplayName("returns participant when user is a member of the trip")
        void returnsParticipantForMember() {
            Optional<Participant> result = participantRepository.findByTripIdAndUserId(trip.getId(), USER_ALICE);
            assertThat(result).isPresent();
            assertThat(result.get().getRole()).isEqualTo(ParticipantRole.OWNER);
        }

        @Test
        @DisplayName("returns empty when user is not a member of the trip")
        void returnsEmptyForNonMember() {
            Optional<Participant> result = participantRepository.findByTripIdAndUserId(trip.getId(), UUID.randomUUID());
            assertThat(result).isEmpty();
        }
    }

    // =========================================================================
    // existsByTripIdAndUserId
    // =========================================================================

    @Nested
    @DisplayName("existsByTripIdAndUserId")
    class ExistsByTripIdAndUserId {

        @Test
        @DisplayName("returns true when user is already a participant")
        void returnsTrueForExistingParticipant() {
            assertThat(participantRepository.existsByTripIdAndUserId(trip.getId(), USER_ALICE)).isTrue();
        }

        @Test
        @DisplayName("returns false when user is not a participant")
        void returnsFalseForNonParticipant() {
            assertThat(participantRepository.existsByTripIdAndUserId(trip.getId(), UUID.randomUUID())).isFalse();
        }
    }

    // =========================================================================
    // deleteAllByTripId
    // =========================================================================

    @Nested
    @DisplayName("deleteAllByTripId")
    class DeleteAllByTripId {

        @Test
        @DisplayName("removes all participants for the given trip")
        void removesAllParticipantsForTrip() {
            participantRepository.deleteAllByTripId(trip.getId());
            List<Participant> remaining = participantRepository.findByTripId(trip.getId());
            assertThat(remaining).isEmpty();
        }

        @Test
        @DisplayName("does not remove participants from other trips")
        void doesNotAffectOtherTrips() {
            Trip otherTrip = savedTrip();
            participantRepository.save(Participant.builder()
                    .trip(otherTrip)
                    .userId(USER_BOB)
                    .role(ParticipantRole.VIEWER)
                    .status(ParticipantStatus.PENDING)
                    .build());

            participantRepository.deleteAllByTripId(trip.getId());

            List<Participant> otherTripParticipants = participantRepository.findByTripId(otherTrip.getId());
            assertThat(otherTripParticipants).hasSize(1);
        }
    }
}
