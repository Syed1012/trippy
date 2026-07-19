package pse.trippy.tripservice.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import pse.trippy.tripservice.dto.request.InviteParticipantRequest;
import pse.trippy.tripservice.dto.response.ParticipantActionResponse;
import pse.trippy.tripservice.dto.response.ParticipantResponse;
import pse.trippy.tripservice.exception.ForbiddenException;
import pse.trippy.tripservice.exception.InvalidTripDataException;
import pse.trippy.tripservice.exception.TripNotFoundException;
import pse.trippy.tripservice.model.entity.Participant;
import pse.trippy.tripservice.model.entity.Trip;
import pse.trippy.tripservice.model.enums.ParticipantRole;
import pse.trippy.tripservice.model.enums.ParticipantStatus;
import pse.trippy.tripservice.model.enums.TripVisibility;
import pse.trippy.tripservice.repository.ParticipantRepository;
import pse.trippy.tripservice.repository.TripRepository;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import pse.trippy.tripservice.config.RabbitMQConfig;
import pse.trippy.tripservice.dto.event.ParticipantEvent;

@ExtendWith(MockitoExtension.class)
@DisplayName("ParticipantService")
class ParticipantServiceTest {

    @Mock
    private ParticipantRepository participantRepository;
    @Mock
    private TripRepository tripRepository;
    @Mock
    private RabbitTemplate rabbitTemplate;

    @InjectMocks
    private ParticipantService participantService;

    private static final UUID TRIP_ID = UUID.randomUUID();
    private static final UUID OWNER_ID = UUID.randomUUID();
    private static final UUID INVITEE_ID = UUID.randomUUID();
    private Trip trip;

    @BeforeEach
    void setUp() {
        trip = Trip.builder()
                .title("Test Trip")
                .destination("Barcelona")
                .startDate(LocalDate.of(2026, 7, 1))
                .endDate(LocalDate.of(2026, 7, 7))
                .maxParticipants(20)
                .createdBy(OWNER_ID)
                .build();
        trip.setId(TRIP_ID);
    }

    private Participant ownerParticipant() {
        Participant p = Participant.builder()
                .trip(trip)
                .userId(OWNER_ID)
                .role(ParticipantRole.OWNER)
                .status(ParticipantStatus.ACCEPTED)
                .build();
        p.setId(UUID.randomUUID());
        return p;
    }

    private Participant invitedParticipant() {
        Participant p = Participant.builder()
                .trip(trip)
                .userId(INVITEE_ID)
                .role(ParticipantRole.MEMBER)
                .status(ParticipantStatus.INVITED)
                .build();
        p.setId(UUID.randomUUID());
        return p;
    }

    private Participant acceptedMember() {
        Participant p = Participant.builder()
                .trip(trip)
                .userId(INVITEE_ID)
                .role(ParticipantRole.MEMBER)
                .status(ParticipantStatus.ACCEPTED)
                .build();
        p.setId(UUID.randomUUID());
        return p;
    }

    // =========================================================================
    // inviteParticipant
    // =========================================================================

    @Nested
    @DisplayName("inviteParticipant")
    class InviteParticipant {

        @Test
        @DisplayName("owner can invite a new participant directly")
        void ownerCanInvite() {
            InviteParticipantRequest request = new InviteParticipantRequest(INVITEE_ID, null, null, "TestOwner");

            when(tripRepository.findById(TRIP_ID)).thenReturn(Optional.of(trip));
            when(participantRepository.findByTripIdAndUserId(TRIP_ID, OWNER_ID))
                    .thenReturn(Optional.of(ownerParticipant()));
            when(participantRepository.existsByTripIdAndUserId(TRIP_ID, INVITEE_ID)).thenReturn(false);
            when(participantRepository.countByTripIdAndStatusIn(eq(TRIP_ID), any(Collection.class))).thenReturn(1L);
            when(participantRepository.save(any(Participant.class))).thenAnswer(invocation -> {
                Participant p = invocation.getArgument(0);
                p.setId(UUID.randomUUID());
                return p;
            });

            ParticipantActionResponse response = participantService.inviteParticipant(TRIP_ID, request, OWNER_ID);

            assertThat(response.message()).isEqualTo("Participant invited successfully");
            assertThat(response.participant().userId()).isEqualTo(INVITEE_ID);
            assertThat(response.participant().role()).isEqualTo("MEMBER");
            assertThat(response.participant().status()).isEqualTo("INVITED");
            verify(rabbitTemplate).convertAndSend(eq(RabbitMQConfig.TRIP_EXCHANGE), eq("trip.participant.invited"), any(java.util.Map.class));
        }

        @Test
        @DisplayName("regular member invite creates PENDING_APPROVAL and notifies owner")
        void memberInviteProposesForApproval() {
            UUID memberUserId = UUID.randomUUID();
            Participant memberParticipant = Participant.builder()
                    .trip(trip).userId(memberUserId)
                    .role(ParticipantRole.MEMBER).status(ParticipantStatus.ACCEPTED)
                    .build();
            memberParticipant.setId(UUID.randomUUID());

            InviteParticipantRequest request = new InviteParticipantRequest(INVITEE_ID, null, "Great traveler!", "MemberName");

            when(tripRepository.findById(TRIP_ID)).thenReturn(Optional.of(trip));
            when(participantRepository.findByTripIdAndUserId(TRIP_ID, memberUserId))
                    .thenReturn(Optional.of(memberParticipant));
            when(participantRepository.existsByTripIdAndUserId(TRIP_ID, INVITEE_ID)).thenReturn(false);
            when(participantRepository.countByTripIdAndStatusIn(eq(TRIP_ID), any(Collection.class))).thenReturn(2L);
            when(participantRepository.save(any(Participant.class))).thenAnswer(invocation -> {
                Participant p = invocation.getArgument(0);
                p.setId(UUID.randomUUID());
                return p;
            });
            when(participantRepository.findByTripId(TRIP_ID)).thenReturn(List.of(ownerParticipant()));

            ParticipantActionResponse response = participantService.inviteParticipant(TRIP_ID, request, memberUserId);

            assertThat(response.message()).contains("awaiting owner approval");
            assertThat(response.participant().status()).isEqualTo("PENDING_APPROVAL");
            verify(rabbitTemplate).convertAndSend(eq(RabbitMQConfig.TRIP_EXCHANGE), eq("trip.participant.invite_proposed"), any(java.util.Map.class));
        }

        @Test
        @DisplayName("throws TripNotFoundException for unknown trip")
        void throwsForUnknownTrip() {
            when(tripRepository.findById(TRIP_ID)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> participantService.inviteParticipant(
                    TRIP_ID, new InviteParticipantRequest(INVITEE_ID, null, null, null), OWNER_ID))
                    .isInstanceOf(TripNotFoundException.class);
        }

        @Test
        @DisplayName("non-owner cannot invite")
        void nonOwnerCannotInvite() {
            when(tripRepository.findById(TRIP_ID)).thenReturn(Optional.of(trip));
            when(participantRepository.findByTripIdAndUserId(TRIP_ID, INVITEE_ID))
                    .thenReturn(Optional.of(invitedParticipant()));

            assertThatThrownBy(() -> participantService.inviteParticipant(
                    TRIP_ID, new InviteParticipantRequest(UUID.randomUUID(), null, null, null), INVITEE_ID))
                    .isInstanceOf(ForbiddenException.class);
        }

        @Test
        @DisplayName("throws when user is already a participant")
        void throwsForDuplicateParticipant() {
            when(tripRepository.findById(TRIP_ID)).thenReturn(Optional.of(trip));
            when(participantRepository.findByTripIdAndUserId(TRIP_ID, OWNER_ID))
                    .thenReturn(Optional.of(ownerParticipant()));
            when(participantRepository.existsByTripIdAndUserId(TRIP_ID, INVITEE_ID)).thenReturn(true);

            assertThatThrownBy(() -> participantService.inviteParticipant(
                    TRIP_ID, new InviteParticipantRequest(INVITEE_ID, null, null, null), OWNER_ID))
                    .isInstanceOf(InvalidTripDataException.class)
                    .hasMessageContaining("already a participant");
        }

        @Test
        @DisplayName("throws when max participants reached")
        void throwsWhenMaxReached() {
            when(tripRepository.findById(TRIP_ID)).thenReturn(Optional.of(trip));
            when(participantRepository.findByTripIdAndUserId(TRIP_ID, OWNER_ID))
                    .thenReturn(Optional.of(ownerParticipant()));
            when(participantRepository.existsByTripIdAndUserId(TRIP_ID, INVITEE_ID)).thenReturn(false);
            when(participantRepository.countByTripIdAndStatusIn(eq(TRIP_ID), any(Collection.class))).thenReturn(20L);

            assertThatThrownBy(() -> participantService.inviteParticipant(
                    TRIP_ID, new InviteParticipantRequest(INVITEE_ID, null, null, null), OWNER_ID))
                    .isInstanceOf(InvalidTripDataException.class)
                    .hasMessageContaining("maximum");
        }
    }

    // =========================================================================
    // acceptInvite
    // =========================================================================

    @Nested
    @DisplayName("acceptInvite")
    class AcceptInvite {

        @Test
        @DisplayName("invitee can accept an invitation")
        void inviteeCanAccept() {
            Participant invited = invitedParticipant();

            when(tripRepository.findById(TRIP_ID)).thenReturn(Optional.of(trip));
            when(participantRepository.findByTripIdAndUserId(TRIP_ID, INVITEE_ID))
                    .thenReturn(Optional.of(invited));
            when(participantRepository.save(any(Participant.class))).thenAnswer(i -> i.getArgument(0));

            ParticipantActionResponse response = participantService.acceptInvite(TRIP_ID, INVITEE_ID);

            assertThat(response.message()).isEqualTo("Invitation accepted successfully");
            assertThat(response.participant().status()).isEqualTo("ACCEPTED");
            assertThat(response.participant().joinedAt()).isNotNull();
            verify(rabbitTemplate).convertAndSend(eq(RabbitMQConfig.TRIP_EXCHANGE), eq("trip.participant.joined"), any(ParticipantEvent.class));
        }

        @Test
        @DisplayName("throws when no invitation exists")
        void throwsWhenNoInvitation() {
            when(tripRepository.findById(TRIP_ID)).thenReturn(Optional.of(trip));
            when(participantRepository.findByTripIdAndUserId(TRIP_ID, INVITEE_ID))
                    .thenReturn(Optional.empty());

            assertThatThrownBy(() -> participantService.acceptInvite(TRIP_ID, INVITEE_ID))
                    .isInstanceOf(InvalidTripDataException.class);
        }

        @Test
        @DisplayName("throws when invitation is not in INVITED status")
        void throwsWhenNotInvited() {
            when(tripRepository.findById(TRIP_ID)).thenReturn(Optional.of(trip));
            when(participantRepository.findByTripIdAndUserId(TRIP_ID, INVITEE_ID))
                    .thenReturn(Optional.of(acceptedMember()));

            assertThatThrownBy(() -> participantService.acceptInvite(TRIP_ID, INVITEE_ID))
                    .isInstanceOf(InvalidTripDataException.class)
                    .hasMessageContaining("not in INVITED status");
        }
    }

    // =========================================================================
    // declineInvite
    // =========================================================================

    @Nested
    @DisplayName("declineInvite")
    class DeclineInvite {

        @Test
        @DisplayName("invitee can decline an invitation")
        void inviteeCanDecline() {
            Participant invited = invitedParticipant();

            when(tripRepository.findById(TRIP_ID)).thenReturn(Optional.of(trip));
            when(participantRepository.findByTripIdAndUserId(TRIP_ID, INVITEE_ID))
                    .thenReturn(Optional.of(invited));
            when(participantRepository.save(any(Participant.class))).thenAnswer(i -> i.getArgument(0));

            ParticipantActionResponse response = participantService.declineInvite(TRIP_ID, INVITEE_ID);

            assertThat(response.message()).isEqualTo("Invitation declined successfully");
            assertThat(response.participant().status()).isEqualTo("DECLINED");
            verify(rabbitTemplate).convertAndSend(eq(RabbitMQConfig.TRIP_EXCHANGE), eq("trip.participant.declined"), any(ParticipantEvent.class));
        }

        @Test
        @DisplayName("throws when invitation is not in INVITED status")
        void throwsWhenNotInvited() {
            when(tripRepository.findById(TRIP_ID)).thenReturn(Optional.of(trip));
            when(participantRepository.findByTripIdAndUserId(TRIP_ID, INVITEE_ID))
                    .thenReturn(Optional.of(acceptedMember()));

            assertThatThrownBy(() -> participantService.declineInvite(TRIP_ID, INVITEE_ID))
                    .isInstanceOf(InvalidTripDataException.class);
        }
    }

    // =========================================================================
    // leaveTrip
    // =========================================================================

    @Nested
    @DisplayName("leaveTrip")
    class LeaveTrip {

        @Test
        @DisplayName("member can leave the trip")
        void memberCanLeave() {
            when(tripRepository.findById(TRIP_ID)).thenReturn(Optional.of(trip));
            when(participantRepository.findByTripIdAndUserId(TRIP_ID, INVITEE_ID))
                    .thenReturn(Optional.of(acceptedMember()));

            participantService.leaveTrip(TRIP_ID, INVITEE_ID);

            verify(participantRepository).delete(any(Participant.class));
            verify(rabbitTemplate).convertAndSend(eq(RabbitMQConfig.TRIP_EXCHANGE), eq("trip.participant.left"), any(ParticipantEvent.class));
        }

        @Test
        @DisplayName("owner cannot leave the trip")
        void ownerCannotLeave() {
            when(tripRepository.findById(TRIP_ID)).thenReturn(Optional.of(trip));
            when(participantRepository.findByTripIdAndUserId(TRIP_ID, OWNER_ID))
                    .thenReturn(Optional.of(ownerParticipant()));

            assertThatThrownBy(() -> participantService.leaveTrip(TRIP_ID, OWNER_ID))
                    .isInstanceOf(ForbiddenException.class)
                    .hasMessageContaining("Owner cannot leave");

            verify(participantRepository, never()).delete(any(Participant.class));
        }

        @Test
        @DisplayName("throws when user is not a participant")
        void throwsWhenNotParticipant() {
            when(tripRepository.findById(TRIP_ID)).thenReturn(Optional.of(trip));
            when(participantRepository.findByTripIdAndUserId(TRIP_ID, INVITEE_ID))
                    .thenReturn(Optional.empty());

            assertThatThrownBy(() -> participantService.leaveTrip(TRIP_ID, INVITEE_ID))
                    .isInstanceOf(ForbiddenException.class);
        }
    }

    // =========================================================================
    // listParticipants
    // =========================================================================

    @Nested
    @DisplayName("listParticipants")
    class ListParticipants {

        @Test
        @DisplayName("accepted participant can list participants")
        void acceptedCanList() {
            Participant owner = ownerParticipant();
            Participant member = acceptedMember();

            when(tripRepository.findById(TRIP_ID)).thenReturn(Optional.of(trip));
            when(participantRepository.findByTripIdAndUserId(TRIP_ID, INVITEE_ID))
                    .thenReturn(Optional.of(member));
            when(participantRepository.findByTripId(TRIP_ID))
                    .thenReturn(List.of(owner, member));

            List<ParticipantResponse> result = participantService.listParticipants(TRIP_ID, INVITEE_ID);

            assertThat(result).hasSize(2);
        }

        @Test
        @DisplayName("non-participant cannot list participants")
        void nonParticipantCannotList() {
            when(tripRepository.findById(TRIP_ID)).thenReturn(Optional.of(trip));
            when(participantRepository.findByTripIdAndUserId(TRIP_ID, INVITEE_ID))
                    .thenReturn(Optional.empty());

            assertThatThrownBy(() -> participantService.listParticipants(TRIP_ID, INVITEE_ID))
                    .isInstanceOf(ForbiddenException.class);
        }

        @Test
        @DisplayName("throws TripNotFoundException for unknown trip")
        void throwsForUnknownTrip() {
            when(tripRepository.findById(TRIP_ID)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> participantService.listParticipants(TRIP_ID, INVITEE_ID))
                    .isInstanceOf(TripNotFoundException.class);
        }
    }

        @Nested
        @DisplayName("isAcceptedParticipant")
        class IsAcceptedParticipant {

                @Test
                @DisplayName("returns repository accepted-membership result")
                void returnsAcceptedMembershipResult() {
                        when(participantRepository.existsByTripIdAndUserIdAndStatus(
                                        TRIP_ID, INVITEE_ID, ParticipantStatus.ACCEPTED)).thenReturn(true);

                        assertThat(participantService.isAcceptedParticipant(TRIP_ID, INVITEE_ID)).isTrue();

                        verify(participantRepository).existsByTripIdAndUserIdAndStatus(
                                        TRIP_ID, INVITEE_ID, ParticipantStatus.ACCEPTED);
                }
        }

    // =========================================================================
    // requestJoin
    // =========================================================================

    @Nested
    @DisplayName("requestJoin")
    class RequestJoin {

        @BeforeEach
        void makePublic() {
            trip.setVisibility(TripVisibility.PUBLIC);
        }

        @Test
        @DisplayName("user can request to join a public trip")
        void canRequestJoin() {
            when(tripRepository.findById(TRIP_ID)).thenReturn(Optional.of(trip));
            when(participantRepository.existsByTripIdAndUserId(TRIP_ID, INVITEE_ID)).thenReturn(false);
            when(participantRepository.countByTripIdAndStatusIn(eq(TRIP_ID), any(Collection.class))).thenReturn(1L);
            when(participantRepository.save(any(Participant.class))).thenAnswer(invocation -> {
                Participant p = invocation.getArgument(0);
                p.setId(UUID.randomUUID());
                return p;
            });
            when(participantRepository.findByTripId(TRIP_ID)).thenReturn(List.of(ownerParticipant()));

            ParticipantActionResponse response = participantService.requestJoin(TRIP_ID, INVITEE_ID, "TestUser", null);

            assertThat(response.message()).contains("request to join");
            assertThat(response.participant().status()).isEqualTo("PENDING_APPROVAL");
            assertThat(response.participant().role()).isEqualTo("MEMBER");
            verify(rabbitTemplate).convertAndSend(eq(RabbitMQConfig.TRIP_EXCHANGE),
                    eq("trip.participant.join_requested"), any(java.util.Map.class));
        }

        @Test
        @DisplayName("throws for non-public trip")
        void throwsForPrivateTrip() {
            trip.setVisibility(TripVisibility.PRIVATE);
            when(tripRepository.findById(TRIP_ID)).thenReturn(Optional.of(trip));

            assertThatThrownBy(() -> participantService.requestJoin(TRIP_ID, INVITEE_ID, "TestUser", null))
                    .isInstanceOf(ForbiddenException.class)
                    .hasMessageContaining("not public");
        }

        @Test
        @DisplayName("throws when already a participant")
        void throwsWhenAlreadyParticipant() {
            when(tripRepository.findById(TRIP_ID)).thenReturn(Optional.of(trip));
            when(participantRepository.existsByTripIdAndUserId(TRIP_ID, INVITEE_ID)).thenReturn(true);

            assertThatThrownBy(() -> participantService.requestJoin(TRIP_ID, INVITEE_ID, "TestUser", null))
                    .isInstanceOf(InvalidTripDataException.class)
                    .hasMessageContaining("already a participant");
        }

        @Test
        @DisplayName("throws when max participants reached")
        void throwsWhenMaxReached() {
            when(tripRepository.findById(TRIP_ID)).thenReturn(Optional.of(trip));
            when(participantRepository.existsByTripIdAndUserId(TRIP_ID, INVITEE_ID)).thenReturn(false);
            when(participantRepository.countByTripIdAndStatusIn(eq(TRIP_ID), any(Collection.class))).thenReturn(20L);

            assertThatThrownBy(() -> participantService.requestJoin(TRIP_ID, INVITEE_ID, "TestUser", null))
                    .isInstanceOf(InvalidTripDataException.class)
                    .hasMessageContaining("maximum");
        }
    }

    // =========================================================================
    // approveInvite
    // =========================================================================

    @Nested
    @DisplayName("approveInvite")
    class ApproveInvite {

        @Test
        @DisplayName("owner can approve a pending join request")
        void ownerCanApprove() {
            Participant pending = Participant.builder()
                    .trip(trip).userId(INVITEE_ID)
                    .role(ParticipantRole.MEMBER)
                    .status(ParticipantStatus.PENDING_APPROVAL)
                    .build();
            pending.setId(UUID.randomUUID());

            when(tripRepository.findById(TRIP_ID)).thenReturn(Optional.of(trip));
            when(participantRepository.findByTripIdAndUserId(TRIP_ID, OWNER_ID))
                    .thenReturn(Optional.of(ownerParticipant()));
            when(participantRepository.findByTripIdAndUserId(TRIP_ID, INVITEE_ID))
                    .thenReturn(Optional.of(pending));
            when(participantRepository.save(any(Participant.class))).thenAnswer(i -> i.getArgument(0));

            ParticipantActionResponse response = participantService.approveInvite(TRIP_ID, INVITEE_ID, OWNER_ID);

            assertThat(response.message()).contains("approved");
            assertThat(response.participant().status()).isEqualTo("ACCEPTED");
            assertThat(response.participant().joinedAt()).isNotNull();
            verify(rabbitTemplate).convertAndSend(eq(RabbitMQConfig.TRIP_EXCHANGE),
                    eq("trip.participant.approved"), any(java.util.Map.class));
        }

        @Test
        @DisplayName("non-owner cannot approve")
        void nonOwnerCannotApprove() {
            UUID nonOwner = UUID.randomUUID();
            when(tripRepository.findById(TRIP_ID)).thenReturn(Optional.of(trip));
            when(participantRepository.findByTripIdAndUserId(TRIP_ID, nonOwner))
                    .thenReturn(Optional.empty());

            assertThatThrownBy(() -> participantService.approveInvite(TRIP_ID, INVITEE_ID, nonOwner))
                    .isInstanceOf(ForbiddenException.class)
                    .hasMessageContaining("owner");
        }

        @Test
        @DisplayName("throws when invite is not PENDING_APPROVAL")
        void throwsWhenNotPending() {
            Participant accepted = acceptedMember();
            when(tripRepository.findById(TRIP_ID)).thenReturn(Optional.of(trip));
            when(participantRepository.findByTripIdAndUserId(TRIP_ID, OWNER_ID))
                    .thenReturn(Optional.of(ownerParticipant()));
            when(participantRepository.findByTripIdAndUserId(TRIP_ID, INVITEE_ID))
                    .thenReturn(Optional.of(accepted));

            assertThatThrownBy(() -> participantService.approveInvite(TRIP_ID, INVITEE_ID, OWNER_ID))
                    .isInstanceOf(InvalidTripDataException.class)
                    .hasMessageContaining("not pending");
        }
    }

    // =========================================================================
    // rejectInvite
    // =========================================================================

    @Nested
    @DisplayName("rejectInvite")
    class RejectInvite {

        @Test
        @DisplayName("owner can reject a pending join request")
        void ownerCanReject() {
            Participant pending = Participant.builder()
                    .trip(trip).userId(INVITEE_ID)
                    .role(ParticipantRole.MEMBER)
                    .status(ParticipantStatus.PENDING_APPROVAL)
                    .build();
            pending.setId(UUID.randomUUID());

            when(tripRepository.findById(TRIP_ID)).thenReturn(Optional.of(trip));
            when(participantRepository.findByTripIdAndUserId(TRIP_ID, OWNER_ID))
                    .thenReturn(Optional.of(ownerParticipant()));
            when(participantRepository.findByTripIdAndUserId(TRIP_ID, INVITEE_ID))
                    .thenReturn(Optional.of(pending));

            ParticipantActionResponse response = participantService.rejectInvite(TRIP_ID, new InviteParticipantRequest(INVITEE_ID, null, null, null), OWNER_ID);

            assertThat(response.message()).contains("rejected");
            assertThat(response.participant()).isNull();
            verify(participantRepository).delete(pending);
        }

        @Test
        @DisplayName("throws when participant is not in pending or invited state")
        void throwsWhenNotPending() {
            Participant accepted = acceptedMember();
            when(tripRepository.findById(TRIP_ID)).thenReturn(Optional.of(trip));
            when(participantRepository.findByTripIdAndUserId(TRIP_ID, OWNER_ID))
                    .thenReturn(Optional.of(ownerParticipant()));
            when(participantRepository.findByTripIdAndUserId(TRIP_ID, INVITEE_ID))
                    .thenReturn(Optional.of(accepted));

            assertThatThrownBy(() -> participantService.rejectInvite(TRIP_ID, new InviteParticipantRequest(INVITEE_ID, null, null, null), OWNER_ID))
                    .isInstanceOf(InvalidTripDataException.class)
                    .hasMessageContaining("not in a pending or invited state");
        }

        @Test
        @DisplayName("non-owner cannot reject")
        void nonOwnerCannotReject() {
            UUID nonOwner = UUID.randomUUID();
            when(tripRepository.findById(TRIP_ID)).thenReturn(Optional.of(trip));
            when(participantRepository.findByTripIdAndUserId(TRIP_ID, nonOwner))
                    .thenReturn(Optional.empty());

            assertThatThrownBy(() -> participantService.rejectInvite(TRIP_ID, new InviteParticipantRequest(INVITEE_ID, null, null, null), nonOwner))
                    .isInstanceOf(ForbiddenException.class)
                    .hasMessageContaining("owner");
        }
    }

    // =========================================================================
    // listParticipants on public trips
    // =========================================================================

    @Nested
    @DisplayName("listParticipants (public trip)")
    class ListParticipantsPublicTrip {

        @Test
        @DisplayName("anyone can list participants of a public trip")
        void publicTripAllowsAll() {
            trip.setVisibility(TripVisibility.PUBLIC);
            UUID randomUser = UUID.randomUUID();
            Participant owner = ownerParticipant();

            when(tripRepository.findById(TRIP_ID)).thenReturn(Optional.of(trip));
            when(participantRepository.findByTripId(TRIP_ID)).thenReturn(List.of(owner));

            List<ParticipantResponse> result = participantService.listParticipants(TRIP_ID, randomUser);

            assertThat(result).hasSize(1);
        }
    }
}
