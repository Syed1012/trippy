package pse.trippy.aiservice.model.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

@Entity
@Table(
        name = "generation_history",
        schema = "ai_schema",
        indexes = {
                @Index(name = "idx_generation_history_generation_id", columnList = "generation_id"),
                @Index(name = "idx_generation_history_trip_id", columnList = "trip_id"),
                @Index(name = "idx_generation_history_created_at", columnList = "created_at")
        }
)
@Getter
@Setter
@NoArgsConstructor
public class GenerationHistory {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", updatable = false, nullable = false)
    private UUID id;

    @NotNull
    @Column(name = "generation_id", nullable = false, unique = true)
    private UUID generationId;

    @Column(name = "trip_id")
    private UUID tripId;

    @NotBlank
    @Column(name = "destination", nullable = false, length = 200)
    private String destination;

    @NotNull
    @Column(name = "start_date", nullable = false)
    private LocalDate startDate;

    @NotNull
    @Column(name = "end_date", nullable = false)
    private LocalDate endDate;

    @Column(name = "prompt_hash", length = 64)
    private String promptHash;

    @Column(name = "fallback_used", nullable = false)
    private boolean fallbackUsed = false;

    @Column(name = "retry_count", nullable = false)
    private int retryCount = 0;

    @Column(name = "status", nullable = false, length = 20)
    private String status = "SUCCESS";

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "request_payload")
    @Setter(AccessLevel.NONE)
    private Map<String, Object> requestPayload;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "response_payload")
    @Setter(AccessLevel.NONE)
    private Map<String, Object> responsePayload;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @PrePersist
    public void prePersist() {
        this.createdAt = Instant.now();
    }

    @Builder
    private GenerationHistory(UUID id, UUID generationId, UUID tripId, String destination,
                              LocalDate startDate, LocalDate endDate, String promptHash,
                              boolean fallbackUsed, int retryCount, String status,
                              Map<String, Object> requestPayload,
                              Map<String, Object> responsePayload,
                              Instant createdAt) {
        this.id = id;
        this.generationId = generationId;
        this.tripId = tripId;
        this.destination = destination;
        this.startDate = startDate;
        this.endDate = endDate;
        this.promptHash = promptHash;
        this.fallbackUsed = fallbackUsed;
        this.retryCount = retryCount;
        this.status = status == null ? "SUCCESS" : status;
        setRequestPayload(requestPayload);
        setResponsePayload(responsePayload);
        this.createdAt = createdAt;
    }

    public Map<String, Object> getRequestPayload() {
        return copyPayload(requestPayload);
    }

    public void setRequestPayload(Map<String, Object> requestPayload) {
        this.requestPayload = copyPayload(requestPayload);
    }

    public Map<String, Object> getResponsePayload() {
        return copyPayload(responsePayload);
    }

    public void setResponsePayload(Map<String, Object> responsePayload) {
        this.responsePayload = copyPayload(responsePayload);
    }

    public static class GenerationHistoryBuilder {
        public GenerationHistoryBuilder requestPayload(Map<String, Object> requestPayload) {
            this.requestPayload = copyPayload(requestPayload);
            return this;
        }

        public GenerationHistoryBuilder responsePayload(Map<String, Object> responsePayload) {
            this.responsePayload = copyPayload(responsePayload);
            return this;
        }
    }

    private static Map<String, Object> copyPayload(Map<String, Object> payload) {
        return payload == null ? null : new LinkedHashMap<>(payload);
    }
}
