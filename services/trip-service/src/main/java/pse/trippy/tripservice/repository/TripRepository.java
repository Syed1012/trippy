package pse.trippy.tripservice.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import pse.trippy.tripservice.model.entity.Trip;
import pse.trippy.tripservice.model.enums.TripStatus;
import pse.trippy.tripservice.model.enums.TripVisibility;

import java.util.List;
import java.util.UUID;

/**
 * JPA repository for {@link Trip} entities.
 */
@Repository
public interface TripRepository extends JpaRepository<Trip, UUID> {

    List<Trip> findByCreatedBy(UUID createdBy);

    List<Trip> findByStatus(TripStatus status);

    List<Trip> findByVisibility(TripVisibility visibility);

    List<Trip> findByCreatedByAndStatus(UUID createdBy, TripStatus status);

    /**
     * Returns a page of trips where the given user is an ACCEPTED or INVITED participant.
     */
    @Query("""
            SELECT t FROM Trip t
            WHERE t.id IN (
                SELECT p.trip.id FROM Participant p
                WHERE p.userId = :userId AND p.status IN (
                    pse.trippy.tripservice.model.enums.ParticipantStatus.ACCEPTED,
                    pse.trippy.tripservice.model.enums.ParticipantStatus.INVITED
                )
            )
            AND t.status <> pse.trippy.tripservice.model.enums.TripStatus.CANCELLED
            """)
    Page<Trip> findTripsByParticipantUserId(@Param("userId") UUID userId, Pageable pageable);

    @Query("""
            SELECT t FROM Trip t
            WHERE t.visibility = pse.trippy.tripservice.model.enums.TripVisibility.PUBLIC
            AND t.status <> pse.trippy.tripservice.model.enums.TripStatus.CANCELLED
            AND t.status <> pse.trippy.tripservice.model.enums.TripStatus.DRAFT
            AND t.id NOT IN (
                SELECT p.trip.id FROM Participant p
                WHERE p.userId = :userId AND p.status IN (
                    pse.trippy.tripservice.model.enums.ParticipantStatus.ACCEPTED,
                    pse.trippy.tripservice.model.enums.ParticipantStatus.INVITED
                )
            )
            """)
    Page<Trip> findPublicTripsExcludingUser(@Param("userId") UUID userId, Pageable pageable);
}
