package pse.trippy.tripservice.dto.event;

import java.time.Instant;
import java.util.UUID;

public record ParticipantEvent(
        String eventType,
        UUID tripId,
        UUID userId,
        String displayName,
        Instant timestamp
) {
}
