package pse.trippy.aiservice.recommendation.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/**
 * A single AI-generated itinerary suggestion option for a trip day.
 *
 * <p>This entity is intentionally isolated from {@code GenerationHistory} and the
 * rest of the Groq-backed AI pipeline: it is only written/read by the local
 * Ollama recommendation feature surfaced in the trip AI sidebar.
 */
@Entity
@Table(
        name = "itinerary_recommendations",
        schema = "ai_schema",
        indexes = {
                @Index(name = "idx_itinerary_recommendations_trip", columnList = "trip_id"),
                @Index(name = "idx_itinerary_recommendations_trip_day", columnList = "trip_id, day_number")
        }
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ItineraryRecommendation {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", updatable = false, nullable = false)
    private UUID id;

    @Column(name = "trip_id", nullable = false)
    private UUID tripId;

    @Column(name = "day_number", nullable = false)
    private int dayNumber;

    @Column(name = "option_index", nullable = false)
    private int optionIndex;

    @Column(name = "vibe", length = 40)
    private String vibe;

    @Column(name = "title", nullable = false, length = 300)
    private String title;

    @Column(name = "start_time", length = 10)
    private String startTime;

    @Column(name = "end_time", length = 10)
    private String endTime;

    @Column(name = "estimated_cost", precision = 12, scale = 2)
    private BigDecimal estimatedCost;

    @Column(name = "currency", length = 8)
    private String currency;

    @Column(name = "maps_url", length = 1024)
    private String mapsUrl;

    @Column(name = "notes", length = 2000)
    private String notes;

    @Column(name = "model", length = 80)
    private String model;

    @Column(name = "source", nullable = false, length = 20)
    private String source;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @PrePersist
    void onCreate() {
        if (createdAt == null) {
            createdAt = Instant.now();
        }
        if (source == null || source.isBlank()) {
            source = "AI";
        }
    }
}
