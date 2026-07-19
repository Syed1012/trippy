package pse.trippy.notificationservice.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import pse.trippy.notificationservice.model.WebPushSubscription;

import java.util.List;
import java.util.UUID;

import org.springframework.transaction.annotation.Transactional;

@Repository
public interface WebPushSubscriptionRepository extends JpaRepository<WebPushSubscription, UUID> {
    List<WebPushSubscription> findAllByUserId(String userId);
    
    java.util.Optional<WebPushSubscription> findByEndpoint(String endpoint);
    
    @Transactional
    void deleteByEndpoint(String endpoint);
}
