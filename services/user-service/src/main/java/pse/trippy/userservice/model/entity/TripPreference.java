package pse.trippy.userservice.model.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import pse.trippy.userservice.model.enums.BudgetTier;
import pse.trippy.userservice.model.enums.PreferredWeather;
import pse.trippy.userservice.model.enums.TripType;

import java.time.Instant;
import java.util.UUID;

/**
 * Trip-scoped travel preferences captured for a user, persisted in
 * {@code user_schema.trip_preferences}.
 *
 * <p>Each row links a {@code userId} to a {@code tripId} (one preference set per
 * user per trip) and records the desired trip vibe, budget tier, optional
 * weather preference, and free-form notes. The AI service reads these to tailor
 * itinerary suggestions. Timestamps are managed via JPA lifecycle callbacks.
 */
@Entity
@Table(
        name = "trip_preferences",
        schema = "user_schema",
        uniqueConstraints = @UniqueConstraint(
                name = "uq_trip_preferences_user_trip",
                columnNames = {"user_id", "trip_id"}
        )
)
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TripPreference {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", updatable = false, nullable = false)
    private UUID id;

    @NotNull
    @Column(name = "user_id", nullable = false, updatable = false)
    private UUID userId;

    @NotNull
    @Column(name = "trip_id", nullable = false, updatable = false)
    private UUID tripId;

    @Enumerated(EnumType.STRING)
    @Column(name = "trip_type", length = 30)
    private TripType tripType;

    @Enumerated(EnumType.STRING)
    @Column(name = "budget_tier", length = 20)
    private BudgetTier budgetTier;

    @Enumerated(EnumType.STRING)
    @Column(name = "preferred_weather", length = 20)
    private PreferredWeather preferredWeather;

    @Size(max = 500)
    @Column(name = "notes", length = 500)
    private String notes;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    /** Sets {@code createdAt} and {@code updatedAt} before the first persist. */
    @PrePersist
    public void prePersist() {
        Instant now = Instant.now();
        this.createdAt = now;
        this.updatedAt = now;
    }

    /** Refreshes {@code updatedAt} on every subsequent update. */
    @PreUpdate
    public void preUpdate() {
        this.updatedAt = Instant.now();
    }
}
