package pse.trippy.chatservice.dto.event;

import java.util.UUID;

/**
 * STOMP payload broadcast to {@code /topic/trips.{tripId}.typing} when a user
 * starts or stops typing.
 *
 * <p>The server debounces repeated {@code typing=true} events by extending a
 * Redis TTL; clients receive one broadcast per state transition.
 */
public record TypingEvent(
        UUID tripId,
        UUID userId,
        String displayName,
        boolean typing
) {}
