package pse.trippy.tripservice.dto.request;

import java.util.UUID;

public record InviteParticipantRequest(
        UUID userId,
        String email,
        String message,
        String inviterName,
        String inviteeName
) {
    public InviteParticipantRequest(UUID userId, String email, String message, String inviterName) {
        this(userId, email, message, inviterName, null);
    }
}
