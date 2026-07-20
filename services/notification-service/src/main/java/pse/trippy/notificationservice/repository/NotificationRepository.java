package pse.trippy.notificationservice.repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import pse.trippy.notificationservice.model.entity.Notification;
import pse.trippy.notificationservice.model.enums.NotificationType;

@Repository
public interface NotificationRepository extends JpaRepository<Notification, UUID> {

    Page<Notification> findByUserIdAndDeletedFalseOrderByCreatedAtDesc(UUID userId, Pageable pageable);

    Page<Notification> findByUserIdAndReadFalseAndDeletedFalseOrderByCreatedAtDesc(UUID userId, Pageable pageable);

    Page<Notification> findByUserIdAndTypeAndDeletedFalseOrderByCreatedAtDesc(
            UUID userId, NotificationType type, Pageable pageable);

    Page<Notification> findByUserIdAndTypeAndReadFalseAndDeletedFalseOrderByCreatedAtDesc(
            UUID userId, NotificationType type, Pageable pageable);

    List<Notification> findByUserIdAndReadFalseAndDeletedFalseOrderByCreatedAtDesc(UUID userId);

    long countByUserIdAndReadFalseAndDeletedFalse(UUID userId);

    Optional<Notification> findByIdAndUserIdAndDeletedFalse(UUID id, UUID userId);

    List<Notification> findByUserIdAndType(UUID userId, NotificationType type);

    List<Notification> findByUserIdAndTypeAndDeletedFalseOrderByCreatedAtDesc(
            UUID userId, NotificationType type);

    Page<Notification> findByUserIdOrderByCreatedAtDesc(UUID userId, Pageable pageable);

    List<Notification> findByUserIdAndReadFalseOrderByCreatedAtDesc(UUID userId);

    long countByUserIdAndReadFalse(UUID userId);
}
