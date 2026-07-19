package pse.trippy.tripservice.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import pse.trippy.tripservice.config.RabbitMQConfig;
import pse.trippy.tripservice.model.entity.Participant;
import pse.trippy.tripservice.model.entity.Trip;
import pse.trippy.tripservice.model.enums.ParticipantRole;
import pse.trippy.tripservice.model.enums.ParticipantStatus;
import pse.trippy.tripservice.repository.ParticipantRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@DisplayName("PendingInviteLinkService")
class PendingInviteLinkServiceTest {

    @Mock
    private ParticipantRepository participantRepository;
    @Mock
    private RabbitTemplate rabbitTemplate;

    @InjectMocks
    private PendingInviteLinkService pendingInviteLinkService;

    @Test
    @DisplayName("links case-insensitive email invitations and creates an in-app invite event")
    void linksPendingInviteAndPublishesNotification() {
        UUID tripId = UUID.randomUUID();
        UUID ownerId = UUID.randomUUID();
        UUID inviteeId = UUID.randomUUID();
        Trip trip = Trip.builder()
                .title("Italy getaway")
                .destination("Rome")
                .startDate(LocalDate.of(2026, 8, 1))
                .endDate(LocalDate.of(2026, 8, 4))
                .createdBy(ownerId)
                .build();
        trip.setId(tripId);
        Participant invite = Participant.builder()
                .trip(trip)
                .email("friend@example.com")
                .role(ParticipantRole.MEMBER)
                .status(ParticipantStatus.INVITED)
                .build();

        when(participantRepository.findByEmailIgnoreCaseAndUserIdIsNull("friend@example.com"))
                .thenReturn(List.of(invite));
        when(participantRepository.existsByTripIdAndUserId(tripId, inviteeId)).thenReturn(false);

        int linkedCount = pendingInviteLinkService.linkPendingInvites(inviteeId, " Friend@Example.com ");

        assertThat(linkedCount).isEqualTo(1);
        assertThat(invite.getUserId()).isEqualTo(inviteeId);
        verify(participantRepository).save(invite);

        ArgumentCaptor<Map<String, Object>> eventCaptor = ArgumentCaptor.forClass(Map.class);
        verify(rabbitTemplate).convertAndSend(
                eq(RabbitMQConfig.TRIP_EXCHANGE),
                eq("trip.participant.invited"),
                eventCaptor.capture());
        assertThat(eventCaptor.getValue())
                .containsEntry("tripId", tripId.toString())
                .containsEntry("inviteeId", inviteeId.toString())
                .containsEntry("inviterId", ownerId.toString());
    }
}
