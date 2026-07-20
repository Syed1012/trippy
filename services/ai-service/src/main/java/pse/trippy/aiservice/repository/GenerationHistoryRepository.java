package pse.trippy.aiservice.repository;

import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import jakarta.persistence.LockModeType;
import pse.trippy.aiservice.model.entity.GenerationHistory;

public interface GenerationHistoryRepository extends JpaRepository<GenerationHistory, UUID> {
    Optional<GenerationHistory> findByGenerationId(UUID generationId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select history from GenerationHistory history where history.generationId = :generationId")
    Optional<GenerationHistory> findByGenerationIdForUpdate(@Param("generationId") UUID generationId);
}
