package pse.trippy.aiservice.recommendation.repository;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;
import org.springframework.test.context.ActiveProfiles;
import pse.trippy.aiservice.recommendation.model.ItineraryRecommendation;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

@DataJpaTest
@ActiveProfiles("test")
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@DisplayName("ItineraryRecommendationRepository")
class ItineraryRecommendationRepositoryTest {

    @Autowired
    private ItineraryRecommendationRepository repository;

    @Autowired
    private TestEntityManager entityManager;

    private ItineraryRecommendation row(UUID tripId, int day, int index) {
        return ItineraryRecommendation.builder()
                .tripId(tripId)
                .dayNumber(day)
                .optionIndex(index)
                .vibe("Top Pick")
                .title("Day " + day + " option " + index)
                .source("AI")
                .build();
    }

    @Test
    @DisplayName("findByTripId returns rows ordered by day then option index")
    void findByTrip_ordered() {
        UUID tripId = UUID.randomUUID();
        repository.save(row(tripId, 2, 0));
        repository.save(row(tripId, 1, 1));
        repository.save(row(tripId, 1, 0));
        entityManager.flush();
        entityManager.clear();

        var rows = repository.findByTripIdOrderByDayNumberAscOptionIndexAsc(tripId);

        assertThat(rows).hasSize(3);
        assertThat(rows).extracting(ItineraryRecommendation::getDayNumber).containsExactly(1, 1, 2);
        assertThat(rows.get(0).getOptionIndex()).isEqualTo(0);
        assertThat(rows.get(1).getOptionIndex()).isEqualTo(1);
    }

    @Test
    @DisplayName("bulk deleteByTripId removes only the target trip's rows")
    void deleteByTripId_onlyTargetTrip() {
        UUID tripA = UUID.randomUUID();
        UUID tripB = UUID.randomUUID();
        repository.save(row(tripA, 1, 0));
        repository.save(row(tripA, 2, 0));
        repository.save(row(tripB, 1, 0));
        entityManager.flush();
        entityManager.clear();

        repository.deleteByTripId(tripA);
        entityManager.flush();
        entityManager.clear();

        assertThat(repository.findByTripIdOrderByDayNumberAscOptionIndexAsc(tripA)).isEmpty();
        assertThat(repository.findByTripIdOrderByDayNumberAscOptionIndexAsc(tripB)).hasSize(1);
    }

    @Test
    @DisplayName("bulk deleteByTripIdAndDayNumber removes only that day")
    void deleteByTripIdAndDayNumber_onlyThatDay() {
        UUID tripId = UUID.randomUUID();
        repository.save(row(tripId, 1, 0));
        repository.save(row(tripId, 2, 0));
        repository.save(row(tripId, 2, 1));
        entityManager.flush();
        entityManager.clear();

        repository.deleteByTripIdAndDayNumber(tripId, 2);
        entityManager.flush();
        entityManager.clear();

        var remaining = repository.findByTripIdOrderByDayNumberAscOptionIndexAsc(tripId);
        assertThat(remaining).hasSize(1);
        assertThat(remaining.get(0).getDayNumber()).isEqualTo(1);
    }
}
