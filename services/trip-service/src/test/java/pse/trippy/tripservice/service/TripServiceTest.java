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
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import pse.trippy.tripservice.dto.request.CreateTripRequest;
import pse.trippy.tripservice.dto.request.UpdateTripRequest;
import pse.trippy.tripservice.dto.response.TripDetailResponse;
import pse.trippy.tripservice.dto.response.TripPageResponse;
import pse.trippy.tripservice.dto.response.TripResponse;
import pse.trippy.tripservice.exception.ForbiddenException;
import pse.trippy.tripservice.exception.InvalidTripDataException;
import pse.trippy.tripservice.exception.TripNotFoundException;
import pse.trippy.tripservice.model.entity.Participant;
import pse.trippy.tripservice.model.entity.Trip;
import pse.trippy.tripservice.model.enums.ParticipantRole;
import pse.trippy.tripservice.model.enums.ParticipantStatus;
import pse.trippy.tripservice.model.enums.TripStatus;
import pse.trippy.tripservice.model.enums.TripVisibility;
import pse.trippy.tripservice.repository.ParticipantRepository;
import pse.trippy.tripservice.repository.TripRepository;
import pse.trippy.tripservice.client.SubscriptionClient;
import pse.trippy.tripservice.dto.response.SubscriptionResponse;

import java.time.LocalDate;
import java.util.Collection;
import java.util.Collections;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@DisplayName("TripService")
class TripServiceTest {

    @Mock
    private TripRepository tripRepository;
    @Mock
    private ParticipantRepository participantRepository;
    @Mock
    private RabbitTemplate rabbitTemplate;
    @Mock
    private SubscriptionClient subscriptionClient;
    @Mock
    private PendingInviteLinkService pendingInviteLinkService;


    @InjectMocks
    private TripService tripService;

    private static final UUID USER_ID = UUID.randomUUID();
    private static final UUID TRIP_ID = UUID.randomUUID();
    private Trip trip;

    @BeforeEach
    void setUp() {
        // Removed unnecessary stubbing of subscriptionClient.getSubscription()

        trip = Trip.builder()
                .title("Beach Vacation")
                .destination("Bali")
                .description("Relaxing trip")
                .startDate(LocalDate.of(2026, 8, 1))
                .endDate(LocalDate.of(2026, 8, 10))
                .visibility(TripVisibility.PUBLIC)
                .maxParticipants(10)
                .createdBy(USER_ID)
                .build();
        trip.setId(TRIP_ID);
    }

    private Participant ownerParticipant() {
        Participant p = Participant.builder()
                .trip(trip)
                .userId(USER_ID)
                .role(ParticipantRole.OWNER)
                .status(ParticipantStatus.ACCEPTED)
                .build();
        p.setId(UUID.randomUUID());
        return p;
    }

    // =========================================================================
    // createTrip
    // =========================================================================

    @Nested
    @DisplayName("createTrip")
    class CreateTrip {

        @Test
        @DisplayName("creates trip with valid data and adds owner as participant")
        void createsTrip() {

            when(subscriptionClient.getSubscription(any(UUID.class)))
                    .thenReturn(new SubscriptionResponse("FREE", true, "EUR", null));

            CreateTripRequest request = new CreateTripRequest(
                    "Beach Vacation", "Bali", "Fun trip",
                    LocalDate.of(2026, 8, 1), LocalDate.of(2026, 8, 10),
                    "PUBLIC", 10);

            when(tripRepository.save(any(Trip.class))).thenAnswer(invocation -> {
                Trip t = invocation.getArgument(0);
                t.setId(TRIP_ID);
                return t;
            });
            when(participantRepository.save(any(Participant.class))).thenAnswer(i -> i.getArgument(0));

            TripResponse response = tripService.createTrip(request, USER_ID);

            assertThat(response.id()).isEqualTo(TRIP_ID);
            assertThat(response.title()).isEqualTo("Beach Vacation");
            assertThat(response.destination()).isEqualTo("Bali");
            assertThat(response.status()).isEqualTo("DRAFT");
            assertThat(response.visibility()).isEqualTo("PUBLIC");
            verify(tripRepository).save(any(Trip.class));
            verify(participantRepository).save(any(Participant.class));
        }

        @Test
        @DisplayName("creates a trip with FREE limits when subscription lookup is unavailable")
        void createsTripWhenSubscriptionLookupFails() {
            when(subscriptionClient.getSubscription(any(UUID.class)))
                    .thenThrow(new RuntimeException("payment service unavailable"));
            when(participantRepository.countByUserIdAndRole(USER_ID, ParticipantRole.OWNER)).thenReturn(0L);
            when(tripRepository.save(any(Trip.class))).thenAnswer(invocation -> {
                Trip savedTrip = invocation.getArgument(0);
                savedTrip.setId(TRIP_ID);
                return savedTrip;
            });
            when(participantRepository.save(any(Participant.class))).thenAnswer(i -> i.getArgument(0));

            CreateTripRequest request = new CreateTripRequest(
                    "Fallback Trip", "Delhi", null,
                    LocalDate.of(2026, 8, 1), LocalDate.of(2026, 8, 2),
                    "PUBLIC", 10);

            TripResponse response = tripService.createTrip(request, USER_ID);

            assertThat(response.id()).isEqualTo(TRIP_ID);
            verify(tripRepository).save(any(Trip.class));
            verify(participantRepository).save(any(Participant.class));
        }

        @Test
        @DisplayName("defaults visibility to PRIVATE when null")
        void defaultsVisibility() {

            when(subscriptionClient.getSubscription(any(UUID.class)))
                    .thenReturn(new SubscriptionResponse("FREE", true, "EUR", null));

            CreateTripRequest request = new CreateTripRequest(
                    "Solo Trip", "Tokyo", null,
                    LocalDate.of(2026, 9, 1), LocalDate.of(2026, 9, 5),
                    null, null);

            when(tripRepository.save(any(Trip.class))).thenAnswer(invocation -> {
                Trip t = invocation.getArgument(0);
                t.setId(UUID.randomUUID());
                return t;
            });
            when(participantRepository.save(any(Participant.class))).thenAnswer(i -> i.getArgument(0));

            TripResponse response = tripService.createTrip(request, USER_ID);

            assertThat(response.visibility()).isEqualTo("PRIVATE");
        }

        @Test
        @DisplayName("throws when end date is before start date")
        void throwsForInvalidDates() {

            when(subscriptionClient.getSubscription(any(UUID.class)))
                    .thenReturn(new SubscriptionResponse("FREE", true, "EUR", null));

            CreateTripRequest request = new CreateTripRequest(
                    "Bad Trip", "Mars", null,
                    LocalDate.of(2026, 8, 10), LocalDate.of(2026, 8, 1),
                    "PUBLIC", 5);

            assertThatThrownBy(() -> tripService.createTrip(request, USER_ID))
                    .isInstanceOf(InvalidTripDataException.class)
                    .hasMessageContaining("End date must be on or after start date");
        }

        @Test
        @DisplayName("throws for invalid visibility value")
        void throwsForInvalidVisibility() {

            when(subscriptionClient.getSubscription(any(UUID.class)))
                    .thenReturn(new SubscriptionResponse("FREE", true, "EUR", null));

            CreateTripRequest request = new CreateTripRequest(
                    "Trip", "Place", null,
                    LocalDate.of(2026, 8, 1), LocalDate.of(2026, 8, 5),
                    "INVALID_VIS", 5);

            assertThatThrownBy(() -> tripService.createTrip(request, USER_ID))
                    .isInstanceOf(InvalidTripDataException.class)
                    .hasMessageContaining("Invalid visibility");
        }
    }

    // =========================================================================
    // listPublicTrips
    // =========================================================================

    @Nested
    @DisplayName("listPublicTrips")
    class ListPublicTrips {

        @Test
        @DisplayName("returns page of public trips with user status and member count")
        void returnsPublicTripsWithMetadata() {
            Trip trip2 = Trip.builder()
                    .title("Mountain Hike")
                    .destination("Alps")
                    .startDate(LocalDate.of(2026, 9, 1))
                    .endDate(LocalDate.of(2026, 9, 5))
                    .visibility(TripVisibility.PUBLIC)
                    .maxParticipants(8)
                    .createdBy(UUID.randomUUID())
                    .build();
            trip2.setId(UUID.randomUUID());

            Page<Trip> page = new PageImpl<>(List.of(trip, trip2), PageRequest.of(0, 10), 2);
            when(tripRepository.findPublicTripsExcludingUser(eq(USER_ID), any(PageRequest.class)))
                    .thenReturn(page);

            Participant pending = Participant.builder()
                    .trip(trip)
                    .userId(USER_ID)
                    .status(ParticipantStatus.PENDING_APPROVAL)
                    .role(ParticipantRole.MEMBER)
                    .build();
            when(participantRepository.findByUserIdAndTripIds(eq(USER_ID), any(Collection.class)))
                    .thenReturn(List.of(pending));

            Participant m1 = Participant.builder().trip(trip).userId(UUID.randomUUID())
                    .status(ParticipantStatus.ACCEPTED).role(ParticipantRole.OWNER).build();
            Participant m2 = Participant.builder().trip(trip).userId(UUID.randomUUID())
                    .status(ParticipantStatus.ACCEPTED).role(ParticipantRole.MEMBER).build();
            Participant m3 = Participant.builder().trip(trip).userId(UUID.randomUUID())
                    .status(ParticipantStatus.ACCEPTED).role(ParticipantRole.MEMBER).build();
            when(participantRepository.findByTripIdsAndStatusIn(any(Collection.class), any(Collection.class)))
                    .thenReturn(List.of(m1, m2, m3));

            TripPageResponse response = tripService.listPublicTrips(USER_ID, 0, 10);

            assertThat(response.trips()).hasSize(2);
            TripResponse first = response.trips().get(0);
            assertThat(first.currentUserStatus()).isEqualTo("PENDING_APPROVAL");
            assertThat(first.memberCount()).isEqualTo(3);

            TripResponse second = response.trips().get(1);
            assertThat(second.currentUserStatus()).isNull();
            assertThat(second.memberCount()).isEqualTo(0);
        }

        @Test
        @DisplayName("returns empty page when no public trips exist")
        void returnsEmptyPage() {
            Page<Trip> emptyPage = new PageImpl<>(Collections.emptyList(), PageRequest.of(0, 10), 0);
            when(tripRepository.findPublicTripsExcludingUser(eq(USER_ID), any(PageRequest.class)))
                    .thenReturn(emptyPage);

            TripPageResponse response = tripService.listPublicTrips(USER_ID, 0, 10);

            assertThat(response.trips()).isEmpty();
            assertThat(response.totalElements()).isEqualTo(0);
        }

        @Test
        @DisplayName("returns public trips without user-specific state for anonymous visitors")
        void returnsPublicTripsForAnonymousVisitor() {
            Page<Trip> page = new PageImpl<>(List.of(trip), PageRequest.of(0, 10), 1);
            when(tripRepository.findPublicTrips(any(PageRequest.class))).thenReturn(page);
            when(participantRepository.findByTripIdsAndStatusIn(any(Collection.class), any(Collection.class)))
                    .thenReturn(List.of(ownerParticipant()));

            TripPageResponse response = tripService.listPublicTrips(null, 0, 10);

            assertThat(response.trips()).singleElement().satisfies(result -> {
                assertThat(result.memberCount()).isEqualTo(1);
                assertThat(result.currentUserStatus()).isNull();
            });
            verify(tripRepository).findPublicTrips(any(PageRequest.class));
        }
    }

    // =========================================================================
    // getTripDetail
    // =========================================================================

    @Nested
    @DisplayName("getTripDetail")
    class GetTripDetail {

        @Test
        @DisplayName("returns trip detail for a published (non-DRAFT) public trip without membership check")
        void publicTripAccessible() {
            trip.setVisibility(TripVisibility.PUBLIC);
            trip.setStatus(TripStatus.PLANNED);
            when(tripRepository.findById(TRIP_ID)).thenReturn(Optional.of(trip));
            when(participantRepository.findByTripId(TRIP_ID))
                    .thenReturn(List.of(ownerParticipant()));

            TripDetailResponse response = tripService.getTripDetail(TRIP_ID, UUID.randomUUID());

            assertThat(response.id()).isEqualTo(TRIP_ID);
            assertThat(response.participants()).hasSize(1);
        }

        @Test
        @DisplayName("DRAFT public trip is not visible to non-participants")
        void publicDraftTripHiddenFromNonMembers() {
            trip.setVisibility(TripVisibility.PUBLIC);
            trip.setStatus(TripStatus.DRAFT);
            UUID nonMember = UUID.randomUUID();
            when(tripRepository.findById(TRIP_ID)).thenReturn(Optional.of(trip));
            when(participantRepository.findByTripIdAndUserId(TRIP_ID, nonMember))
                    .thenReturn(Optional.empty());

            assertThatThrownBy(() -> tripService.getTripDetail(TRIP_ID, nonMember))
                    .isInstanceOf(ForbiddenException.class);
        }

        @Test
        @DisplayName("draft private trip requires participant membership")
        void draftPrivateTripRequiresMembership() {
            trip.setStatus(TripStatus.DRAFT);
            trip.setVisibility(TripVisibility.PRIVATE);
            UUID nonMember = UUID.randomUUID();
            when(tripRepository.findById(TRIP_ID)).thenReturn(Optional.of(trip));
            when(participantRepository.findByTripIdAndUserId(TRIP_ID, nonMember))
                    .thenReturn(Optional.empty());

            assertThatThrownBy(() -> tripService.getTripDetail(TRIP_ID, nonMember))
                    .isInstanceOf(ForbiddenException.class);
        }

        @Test
        @DisplayName("planned private trip is accessible to non-members by direct link")
        void plannedPrivateTripAccessibleToNonMembers() {
            trip.setStatus(TripStatus.PLANNED);
            trip.setVisibility(TripVisibility.PRIVATE);
            UUID nonMember = UUID.randomUUID();
            when(tripRepository.findById(TRIP_ID)).thenReturn(Optional.of(trip));

            TripDetailResponse response = tripService.getTripDetail(TRIP_ID, nonMember);
            assertThat(response).isNotNull();
            assertThat(response.visibility()).isEqualTo("PRIVATE");
        }

        @Test
        @DisplayName("throws TripNotFoundException for unknown trip")
        void throwsForUnknownTrip() {
            when(tripRepository.findById(TRIP_ID)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> tripService.getTripDetail(TRIP_ID, USER_ID))
                    .isInstanceOf(TripNotFoundException.class);
        }
    }

    // =========================================================================
    // getSharedTripDetail
    // =========================================================================

    @Nested
    @DisplayName("getSharedTripDetail")
    class GetSharedTripDetail {

        @Test
        @DisplayName("returns shared trip detail for a published (non-DRAFT) trip")
        void sharedTripAccessible() {
            trip.setStatus(TripStatus.PLANNED);
            when(tripRepository.findById(TRIP_ID)).thenReturn(Optional.of(trip));

            TripDetailResponse response = tripService.getSharedTripDetail(TRIP_ID);
            assertThat(response).isNotNull();
            assertThat(response.id()).isEqualTo(TRIP_ID);
        }

        @Test
        @DisplayName("throws ForbiddenException for a DRAFT trip")
        void sharedDraftTripForbidden() {
            trip.setStatus(TripStatus.DRAFT);
            when(tripRepository.findById(TRIP_ID)).thenReturn(Optional.of(trip));

            assertThatThrownBy(() -> tripService.getSharedTripDetail(TRIP_ID))
                    .isInstanceOf(ForbiddenException.class);
        }
    }

    // =========================================================================
    // updateTrip
    // =========================================================================

    @Nested
    @DisplayName("updateTrip")
    class UpdateTrip {

        @Test
        @DisplayName("owner can update trip fields")
        void ownerCanUpdate() {
            when(tripRepository.findById(TRIP_ID)).thenReturn(Optional.of(trip));
            when(participantRepository.findByTripIdAndUserId(TRIP_ID, USER_ID))
                    .thenReturn(Optional.of(ownerParticipant()));
            when(tripRepository.save(any(Trip.class))).thenAnswer(i -> i.getArgument(0));

            UpdateTripRequest request = new UpdateTripRequest(
                    "Updated Title", "Paris", "New desc",
                    LocalDate.of(2026, 9, 1), LocalDate.of(2026, 9, 10),
                    "PLANNED", "PRIVATE", 15, "http://img.jpg");

            TripResponse response = tripService.updateTrip(TRIP_ID, request, USER_ID);

            assertThat(response.title()).isEqualTo("Updated Title");
            assertThat(response.destination()).isEqualTo("Paris");
            assertThat(response.status()).isEqualTo("PLANNED");
            assertThat(response.visibility()).isEqualTo("PRIVATE");
        }

        @Test
        @DisplayName("non-owner cannot update trip")
        void nonOwnerCannotUpdate() {
            UUID nonOwner = UUID.randomUUID();
            when(tripRepository.findById(TRIP_ID)).thenReturn(Optional.of(trip));
            when(participantRepository.findByTripIdAndUserId(TRIP_ID, nonOwner))
                    .thenReturn(Optional.empty());

            UpdateTripRequest request = new UpdateTripRequest(
                    "Hack", null, null, null, null, null, null, null, null);

            assertThatThrownBy(() -> tripService.updateTrip(TRIP_ID, request, nonOwner))
                    .isInstanceOf(ForbiddenException.class)
                    .hasMessageContaining("owner");
        }

        @Test
        @DisplayName("rejects end date before start date on update")
        void rejectsInvalidDateUpdate() {
            when(tripRepository.findById(TRIP_ID)).thenReturn(Optional.of(trip));
            when(participantRepository.findByTripIdAndUserId(TRIP_ID, USER_ID))
                    .thenReturn(Optional.of(ownerParticipant()));

            UpdateTripRequest request = new UpdateTripRequest(
                    null, null, null,
                    LocalDate.of(2026, 9, 10), LocalDate.of(2026, 9, 1),
                    null, null, null, null);

            assertThatThrownBy(() -> tripService.updateTrip(TRIP_ID, request, USER_ID))
                    .isInstanceOf(InvalidTripDataException.class)
                    .hasMessageContaining("End date");
        }
    }

    // =========================================================================
    // deleteTrip
    // =========================================================================

    @Nested
    @DisplayName("deleteTrip")
    class DeleteTrip {

        @Test
        @DisplayName("owner can soft-delete (cancel) a trip")
        void ownerCanDelete() {
            when(tripRepository.findById(TRIP_ID)).thenReturn(Optional.of(trip));
            when(participantRepository.findByTripIdAndUserId(TRIP_ID, USER_ID))
                    .thenReturn(Optional.of(ownerParticipant()));
            when(tripRepository.save(any(Trip.class))).thenAnswer(i -> i.getArgument(0));

            tripService.deleteTrip(TRIP_ID, USER_ID);

            assertThat(trip.getStatus()).isEqualTo(TripStatus.CANCELLED);
            verify(tripRepository).save(trip);
        }

        @Test
        @DisplayName("non-owner cannot delete trip")
        void nonOwnerCannotDelete() {
            UUID nonOwner = UUID.randomUUID();
            when(tripRepository.findById(TRIP_ID)).thenReturn(Optional.of(trip));
            when(participantRepository.findByTripIdAndUserId(TRIP_ID, nonOwner))
                    .thenReturn(Optional.empty());

            assertThatThrownBy(() -> tripService.deleteTrip(TRIP_ID, nonOwner))
                    .isInstanceOf(ForbiddenException.class);
        }

        @Test
        @DisplayName("throws TripNotFoundException for unknown trip")
        void throwsForUnknownTrip() {
            when(tripRepository.findById(TRIP_ID)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> tripService.deleteTrip(TRIP_ID, USER_ID))
                    .isInstanceOf(TripNotFoundException.class);
        }
    }

    // =========================================================================
    // listMyTrips
    // =========================================================================

    @Nested
    @DisplayName("listMyTrips")
    class ListMyTrips {

        @Test
        @DisplayName("returns user's trips paginated")
        void returnsUserTrips() {
            Page<Trip> page = new PageImpl<>(List.of(trip), PageRequest.of(0, 10), 1);
            when(tripRepository.findTripsByParticipantUserId(eq(USER_ID), any(PageRequest.class)))
                    .thenReturn(page);

            TripPageResponse response = tripService.listMyTrips(USER_ID, 0, 10);

            assertThat(response.trips()).hasSize(1);
            assertThat(response.trips().get(0).title()).isEqualTo("Beach Vacation");
            assertThat(response.totalElements()).isEqualTo(1);
        }
    }
}
