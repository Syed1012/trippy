package pse.trippy.tripservice.dto.response;

import java.time.Instant;
import java.util.UUID;

public record ParticipantResponse(
        UUID id,
        UUID userId,
        String email,
        String role,
        String status,
        Instant joinedAt
) {
}
