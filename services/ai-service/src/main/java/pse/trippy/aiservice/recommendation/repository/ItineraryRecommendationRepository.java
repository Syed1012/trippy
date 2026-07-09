package pse.trippy.aiservice.recommendation.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import pse.trippy.aiservice.recommendation.model.ItineraryRecommendation;

import java.util.List;
import java.util.UUID;

public interface ItineraryRecommendationRepository extends JpaRepository<ItineraryRecommendation, UUID> {

    List<ItineraryRecommendation> findByTripIdOrderByDayNumberAscOptionIndexAsc(UUID tripId);

    // Bulk deletes (a single DELETE statement, no per-row version check) so
    // concurrent regenerations for the same trip can't trigger a
    // StaleObjectStateException from a select-then-delete race.
    @Modifying
    @Query("delete from ItineraryRecommendation r where r.tripId = :tripId")
    void deleteByTripId(@Param("tripId") UUID tripId);

    @Modifying
    @Query("delete from ItineraryRecommendation r where r.tripId = :tripId and r.dayNumber = :dayNumber")
    void deleteByTripIdAndDayNumber(@Param("tripId") UUID tripId, @Param("dayNumber") int dayNumber);
}
