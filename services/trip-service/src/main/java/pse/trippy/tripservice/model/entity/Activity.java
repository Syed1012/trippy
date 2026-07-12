package pse.trippy.tripservice.model.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import pse.trippy.tripservice.model.enums.ActivityCategory;

import java.math.BigDecimal;
import java.time.LocalTime;
import java.util.UUID;

/**
 * Represents a single activity within a day plan, persisted in {@code trip_schema.activities}.
 *
 * <p>Activities are ordered within a day plan via {@code orderIndex}.
 */
@Entity
@Table(
        name = "activities",
        schema = "trip_schema",
        indexes = @Index(name = "idx_activities_day_plan_id", columnList = "day_plan_id")
)
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Activity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", updatable = false, nullable = false)
    private UUID id;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "day_plan_id", nullable = false, updatable = false)
    private DayPlan dayPlan;

    @NotBlank
    @Size(max = 200)
    @Column(name = "title", nullable = false, length = 200)
    private String title;

    @Size(max = 2000)
    @Column(name = "description", length = 2000)
    private String description;

    @Size(max = 500)
    @Column(name = "location", length = 500)
    private String location;

    @Column(name = "start_time")
    private LocalTime startTime;

    @Column(name = "end_time")
    private LocalTime endTime;

    @NotNull
    @Enumerated(EnumType.STRING)
    @Column(name = "category", nullable = false, length = 20)
    @Builder.Default
    private ActivityCategory category = ActivityCategory.OTHER;

    @Size(max = 1000)
    @Column(name = "notes", length = 1000)
    private String notes;

    @Column(name = "estimated_cost", precision = 12, scale = 2)
    private BigDecimal estimatedCost;

    @Size(max = 8)
    @Column(name = "currency", length = 8)
    private String currency;

    @Min(0)
    @Column(name = "order_index", nullable = false)
    @Builder.Default
    private int orderIndex = 0;
}
