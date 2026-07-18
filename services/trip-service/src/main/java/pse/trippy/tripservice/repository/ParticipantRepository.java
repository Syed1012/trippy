package pse.trippy.tripservice.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import pse.trippy.tripservice.model.entity.Participant;

import pse.trippy.tripservice.model.enums.ParticipantStatus;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * JPA repository for {@link Participant} entities.
 */
@Repository
public interface ParticipantRepository extends JpaRepository<Participant, UUID> {

    /**
     * Returns all participants belonging to the given trip.
     *
     * @param tripId the trip's UUID
     * @return list of participants in this trip
     */
    List<Participant> findByTripId(UUID tripId);

    /**
     * Returns all participant records for the given user across all trips.
     *
     * @param userId the user's UUID (from User Service)
     * @return list of participant records for this user
     */
    List<Participant> findByUserId(UUID userId);

    /**
     * Returns the participant record for a specific user in a specific trip, if it exists.
     *
     * @param tripId the trip's UUID
     * @param userId the user's UUID
     * @return an {@link Optional} containing the participant record, or empty
     */
    Optional<Participant> findByTripIdAndUserId(UUID tripId, UUID userId);

    /**
     * Returns {@code true} if the given user already has a participant record in the trip.
     *
     * @param tripId the trip's UUID
     * @param userId the user's UUID
     * @return {@code true} if a record exists
     */
    boolean existsByTripIdAndUserId(UUID tripId, UUID userId);

    boolean existsByTripIdAndUserIdAndStatus(UUID tripId, UUID userId, ParticipantStatus status);

    /**
     * Deletes all participant records for the given trip.
     * Used when a trip is permanently deleted.
     *
     * @param tripId the trip's UUID
     */
    @Modifying
    @Query("DELETE FROM Participant p WHERE p.trip.id = :tripId")
    void deleteAllByTripId(@Param("tripId") UUID tripId);

    /**
     * Counts participants in a trip whose status is in the given collection.
     *
     * @param tripId   the trip's UUID
     * @param statuses the statuses to include in the count
     * @return the number of matching participants
     */
    long countByTripIdAndStatusIn(UUID tripId, Collection<ParticipantStatus> statuses);

    /**
     * Returns participant records for the given user across the provided trips.
     *
     * @param userId  the user's UUID
     * @param tripIds the trip UUIDs to look up
     * @return matching participant records
     */
    @Query("SELECT p FROM Participant p WHERE p.userId = :userId AND p.trip.id IN :tripIds")
    List<Participant> findByUserIdAndTripIds(@Param("userId") UUID userId,
                                             @Param("tripIds") Collection<UUID> tripIds);

    /**
     * Returns participant records for the given trips whose status is in the collection.
     *
     * @param tripIds  the trip UUIDs
     * @param statuses the statuses to include
     * @return matching participant records
     */
    @Query("SELECT p FROM Participant p WHERE p.trip.id IN :tripIds AND p.status IN :statuses")
    List<Participant> findByTripIdsAndStatusIn(@Param("tripIds") Collection<UUID> tripIds,
                                               @Param("statuses") Collection<ParticipantStatus> statuses);
}
