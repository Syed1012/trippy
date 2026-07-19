package pse.trippy.tripservice.messaging;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import pse.trippy.tripservice.service.PendingInviteLinkService;

import java.util.Map;
import java.util.UUID;

import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@DisplayName("UserEventListener")
class UserEventListenerTest {

    @Mock
    private PendingInviteLinkService pendingInviteLinkService;

    @InjectMocks
    private UserEventListener listener;

    @Test
    @DisplayName("links pending invitations when a user is registered")
    void linksPendingInvitationsWhenUserRegisters() {
        UUID inviteeId = UUID.randomUUID();
        when(pendingInviteLinkService.linkPendingInvites(inviteeId, "Friend@Example.com"))
                .thenReturn(1);

        listener.handleUserRegistered(Map.of(
                "email", "Friend@Example.com",
                "userId", inviteeId.toString()));

        verify(pendingInviteLinkService).linkPendingInvites(inviteeId, "Friend@Example.com");
    }

    @Test
    @DisplayName("ignores malformed registration events")
    void ignoresMalformedRegistrationEvents() {
        listener.handleUserRegistered(Map.of("email", "friend@example.com", "userId", "not-a-uuid"));

        verifyNoInteractions(pendingInviteLinkService);
    }
}
