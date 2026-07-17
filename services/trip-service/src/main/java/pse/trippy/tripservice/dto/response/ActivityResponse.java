package pse.trippy.tripservice.dto.response;

import java.math.BigDecimal;
import java.time.LocalTime;
import java.util.UUID;

public record ActivityResponse(
        UUID activityId,
        String title,
        String description,
        String location,
        LocalTime startTime,
        LocalTime endTime,
        String category,
        String notes,
        BigDecimal estimatedCost,
        String currency,
        int orderIndex,
        long upvotes,
        long downvotes,
        String currentUserVote
) {
}
