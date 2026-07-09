package pse.trippy.aiservice.recommendation.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pse.trippy.aiservice.recommendation.model.ItineraryRecommendation;
import pse.trippy.aiservice.recommendation.repository.ItineraryRecommendationRepository;

import java.util.List;
import java.util.UUID;

/**
 * Short, dedicated transactions for replacing stored recommendations.
 *
 * <p>Kept out of {@link ItineraryRecommendationService} on purpose so the slow
 * Ollama HTTP call never runs inside a database transaction (which would hold a
 * pooled connection open for the whole generation).
 */
@Service
@RequiredArgsConstructor
class RecommendationPersistence {

    private final ItineraryRecommendationRepository repository;

    @Transactional
    public void replaceForTrip(UUID tripId, List<ItineraryRecommendation> rows) {
        repository.deleteByTripId(tripId);
        repository.saveAll(rows);
    }

    @Transactional
    public void replaceForDay(UUID tripId, int dayNumber, List<ItineraryRecommendation> rows) {
        repository.deleteByTripIdAndDayNumber(tripId, dayNumber);
        repository.saveAll(rows);
    }
}
