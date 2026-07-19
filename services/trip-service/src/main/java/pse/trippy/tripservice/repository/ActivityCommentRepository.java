package pse.trippy.tripservice.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import pse.trippy.tripservice.model.entity.ActivityComment;

import java.util.List;
import java.util.UUID;

public interface ActivityCommentRepository extends JpaRepository<ActivityComment, UUID> {

    List<ActivityComment> findByActivityIdOrderByCreatedAtAsc(UUID activityId);

    long countByActivityId(UUID activityId);

    /**
     * Deletes all comments on activities within the given day plan.
     * Must run before {@link ActivityRepository#deleteAllByDayPlanId} to avoid
     * violating {@code fk_activity_comments_activity}.
     *
     * @param dayPlanId the day plan's UUID
     */
    @Modifying
    @Query("DELETE FROM ActivityComment c WHERE c.activity.dayPlan.id = :dayPlanId")
    void deleteAllByDayPlanId(@Param("dayPlanId") UUID dayPlanId);
}
