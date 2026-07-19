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
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import pse.trippy.tripservice.model.enums.ParticipantRole;
import pse.trippy.tripservice.model.enums.ParticipantStatus;

import java.time.Instant;
import java.util.UUID;

/**
 * Represents a user's membership in a trip, persisted in {@code trip_schema.participants}.
 *
 * <p>The combination of {@code trip} and {@code userId} is unique — a user may
 * only appear once per trip. {@code userId} references a user in the User Service
 * and is stored as a plain UUID without a cross-service FK constraint.
 */
@Entity
@Table(
        name = "participants",
        schema = "trip_schema",
        uniqueConstraints = {
                @UniqueConstraint(
                        name = "uq_participants_trip_user",
                        columnNames = {"trip_id", "user_id"}
                ),
                @UniqueConstraint(
                        name = "uq_participants_trip_email",
                        columnNames = {"trip_id", "email"}
                )
        },
        indexes = @Index(name = "idx_participants_user_id", columnList = "user_id")
)
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Participant {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", updatable = false, nullable = false)
    private UUID id;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "trip_id", nullable = false, updatable = false)
    private Trip trip;

    // Email-only invitations are created before a user account exists. The
    // registration listener fills this field once the invitee signs up.
    @Column(name = "user_id")
    private UUID userId;

    @Column(name = "email", length = 254)
    private String email;

    @NotNull
    @Enumerated(EnumType.STRING)
    @Column(name = "role", nullable = false, length = 20)
    @Builder.Default
    private ParticipantRole role = ParticipantRole.VIEWER;

    @NotNull
    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    @Builder.Default
    private ParticipantStatus status = ParticipantStatus.PENDING;

    @Column(name = "joined_at")
    private Instant joinedAt;

    /**
     * Sets {@code joinedAt} when the participant record is first persisted
     * and their status is {@link ParticipantStatus#ACCEPTED}.
     */
    @PrePersist
    public void prePersist() {
        if (ParticipantStatus.ACCEPTED.equals(this.status)) {
            this.joinedAt = Instant.now();
        }
    }
}
