package pse.trippy.aiservice.recommendation.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import pse.trippy.aiservice.recommendation.model.ItineraryRecommendation;

import java.util.List;
import java.util.UUID;

public interface ItineraryRecommendationRepository extends JpaRepository<ItineraryRecommendation, UUID> {

    List<ItineraryRecommendation> findByTripIdOrderByDayNumberAscOptionIndexAsc(UUID tripId);

    void deleteByTripId(UUID tripId);

    void deleteByTripIdAndDayNumber(UUID tripId, int dayNumber);
}
