package pse.trippy.aiservice.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import pse.trippy.aiservice.model.entity.GenerationHistory;

import java.util.Optional;
import java.util.UUID;

public interface GenerationHistoryRepository extends JpaRepository<GenerationHistory, UUID> {
    Optional<GenerationHistory> findByGenerationId(UUID generationId);
}
