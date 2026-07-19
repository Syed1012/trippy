package pse.trippy.tripservice.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import pse.trippy.tripservice.model.entity.Participant;
import pse.trippy.tripservice.model.enums.ParticipantRole;
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
     * @param userId the user's UUID
     * @return list of participant records for this user
     */
    List<Participant> findByUserId(UUID userId);

    /**
     * Returns the participant record for a specific user in a specific trip.
     */
    Optional<Participant> findByTripIdAndUserId(UUID tripId, UUID userId);

    /**
     * Checks if a participant record exists for the given user in the trip.
     */
    boolean existsByTripIdAndUserId(UUID tripId, UUID userId);

    boolean existsByTripIdAndUserIdAndStatus(UUID tripId, UUID userId, ParticipantStatus status);

    /**
     * Deletes all participant records for the given trip.
     */
    @Modifying
    @Query("DELETE FROM Participant p WHERE p.trip.id = :tripId")
    void deleteAllByTripId(@Param("tripId") UUID tripId);

    /**
     * Counts participants in a trip whose status is in the given collection.
     */
    long countByTripIdAndStatusIn(UUID tripId, Collection<ParticipantStatus> statuses);

    /**
     * Counts how many trips the given user owns.
     *
     * <p>This method is used to enforce subscription limits (e.g., FREE users
     * can create a maximum of 3 trips). It counts all participant records
     * where the user is marked with the {@code OWNER} role.
     *
     * @param userId the user's UUID
     * @param role   the participant role to filter by (typically {@code OWNER})
     * @return the number of trips where the user has the specified role
     */
    long countByUserIdAndRole(UUID userId, ParticipantRole role);

    /**
     * Returns participant records for the given user across the provided trips.
     */
    @Query("SELECT p FROM Participant p WHERE p.userId = :userId AND p.trip.id IN :tripIds")
    List<Participant> findByUserIdAndTripIds(@Param("userId") UUID userId,
                                             @Param("tripIds") Collection<UUID> tripIds);

    /**
     * Returns participant records for the given trips whose status is in the collection.
     */
    @Query("SELECT p FROM Participant p WHERE p.trip.id IN :tripIds AND p.status IN :statuses")
    List<Participant> findByTripIdsAndStatusIn(@Param("tripIds") Collection<UUID> tripIds,
                                               @Param("statuses") Collection<ParticipantStatus> statuses);
}
