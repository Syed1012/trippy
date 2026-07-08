package pse.trippy.userservice.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import pse.trippy.userservice.model.entity.TripPreference;

import java.util.Optional;
import java.util.UUID;

/**
 * JPA repository for {@link TripPreference} entities.
 */
@Repository
public interface TripPreferenceRepository extends JpaRepository<TripPreference, UUID> {

    /**
     * Finds the preference set a user has saved for a specific trip.
     *
     * @param userId the owning user's ID
     * @param tripId the trip the preferences belong to
     * @return the preference row if present
     */
    Optional<TripPreference> findByUserIdAndTripId(UUID userId, UUID tripId);
}
