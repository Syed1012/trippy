package pse.trippy.tripservice.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import pse.trippy.tripservice.dto.request.ActivityRequest;
import pse.trippy.tripservice.dto.request.DayPlanRequest;
import pse.trippy.tripservice.dto.request.UpdateItineraryRequest;
import pse.trippy.tripservice.dto.response.ItineraryResponse;
import pse.trippy.tripservice.exception.ForbiddenException;
import pse.trippy.tripservice.exception.TripNotFoundException;
import pse.trippy.tripservice.model.entity.Activity;
import pse.trippy.tripservice.model.entity.DayPlan;
import pse.trippy.tripservice.model.entity.Itinerary;
import pse.trippy.tripservice.model.entity.Participant;
import pse.trippy.tripservice.model.entity.Trip;
import pse.trippy.tripservice.model.enums.ActivityCategory;
import pse.trippy.tripservice.model.enums.ParticipantRole;
import pse.trippy.tripservice.model.enums.ParticipantStatus;
import pse.trippy.tripservice.model.enums.TripStatus;
import pse.trippy.tripservice.repository.ActivityRepository;
import pse.trippy.tripservice.repository.ActivityVoteRepository;
import pse.trippy.tripservice.repository.DayPlanRepository;
import pse.trippy.tripservice.repository.DayPlanVoteRepository;
import pse.trippy.tripservice.repository.ItineraryRepository;
import pse.trippy.tripservice.repository.ParticipantRepository;
import pse.trippy.tripservice.repository.TripRepository;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.Collections;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@DisplayName("ItineraryService")
class ItineraryServiceTest {

    @Mock
    private TripRepository tripRepository;
    @Mock
    private ItineraryRepository itineraryRepository;
    @Mock
    private DayPlanRepository dayPlanRepository;
    @Mock
    private ActivityRepository activityRepository;
    @Mock
    private ParticipantRepository participantRepository;
    @Mock
    private DayPlanVoteRepository dayPlanVoteRepository;
    @Mock
    private ActivityVoteRepository activityVoteRepository;

    @InjectMocks
    private ItineraryService itineraryService;

    private static final UUID TRIP_ID = UUID.randomUUID();
    private static final UUID USER_ID = UUID.randomUUID();
    private Trip trip;

    @BeforeEach
    void setUp() {
        trip = Trip.builder()
                .title("Test Trip")
                .destination("Barcelona")
                .startDate(LocalDate.of(2026, 7, 1))
                .endDate(LocalDate.of(2026, 7, 7))
                .createdBy(USER_ID)
                .build();
        // Manually set ID since it's normally JPA-generated
        trip.setId(TRIP_ID);
    }

    private Participant participant(ParticipantRole role) {
        return Participant.builder()
                .trip(trip)
                .userId(USER_ID)
                .role(role)
                .status(ParticipantStatus.ACCEPTED)
                .build();
    }

    @Nested
    @DisplayName("getItinerary")
    class GetItinerary {

        @Test
        @DisplayName("returns empty dayPlans when no itinerary exists")
        void returnsEmptyWhenNoItinerary() {
            when(tripRepository.findById(TRIP_ID)).thenReturn(Optional.of(trip));
            when(participantRepository.findByTripIdAndUserId(TRIP_ID, USER_ID))
                    .thenReturn(Optional.of(participant(ParticipantRole.VIEWER)));
            when(itineraryRepository.findByTripId(TRIP_ID)).thenReturn(Optional.empty());

            ItineraryResponse response = itineraryService.getItinerary(TRIP_ID, USER_ID);

            assertThat(response.tripId()).isEqualTo(TRIP_ID);
            assertThat(response.dayPlans()).isEmpty();
            assertThat(response.createdAt()).isNull();
        }

        @Test
        @DisplayName("returns full itinerary with day plans and activities")
        void returnsFullItinerary() {
            Itinerary itinerary = Itinerary.builder().trip(trip).build();
            itinerary.setId(UUID.randomUUID());
            itinerary.setCreatedAt(Instant.now());
            itinerary.setUpdatedAt(Instant.now());

            DayPlan dayPlan = DayPlan.builder()
                    .itinerary(itinerary)
                    .dayNumber(1)
                    .date(LocalDate.of(2026, 7, 1))
                    .title("Arrival Day")
                    .build();
            dayPlan.setId(UUID.randomUUID());

            Activity activity = Activity.builder()
                    .dayPlan(dayPlan)
                    .title("Check into hotel")
                    .description("Hotel Arts Barcelona")
                    .location("Marina 19-21, Barcelona")
                    .startTime(LocalTime.of(14, 0))
                    .endTime(LocalTime.of(15, 0))
                    .category(ActivityCategory.ACCOMMODATION)
                    .orderIndex(0)
                    .build();

            when(tripRepository.findById(TRIP_ID)).thenReturn(Optional.of(trip));
            when(participantRepository.findByTripIdAndUserId(TRIP_ID, USER_ID))
                    .thenReturn(Optional.of(participant(ParticipantRole.VIEWER)));
            when(itineraryRepository.findByTripId(TRIP_ID))
                    .thenReturn(Optional.of(itinerary));
            when(dayPlanRepository.findByItineraryIdOrderByDayNumberAsc(itinerary.getId()))
                    .thenReturn(List.of(dayPlan));
            when(activityRepository.findByDayPlanIdOrderByOrderIndexAsc(dayPlan.getId()))
                    .thenReturn(List.of(activity));

            ItineraryResponse response = itineraryService.getItinerary(TRIP_ID, USER_ID);

            assertThat(response.tripId()).isEqualTo(TRIP_ID);
            assertThat(response.dayPlans()).hasSize(1);
            assertThat(response.dayPlans().get(0).dayNumber()).isEqualTo(1);
            assertThat(response.dayPlans().get(0).title()).isEqualTo("Arrival Day");
            assertThat(response.dayPlans().get(0).activities()).hasSize(1);
            assertThat(response.dayPlans().get(0).activities().get(0).title())
                    .isEqualTo("Check into hotel");
            assertThat(response.dayPlans().get(0).activities().get(0).category())
                    .isEqualTo("ACCOMMODATION");
        }

        @Test
        @DisplayName("throws TripNotFoundException for unknown trip")
        void throwsForUnknownTrip() {
            when(tripRepository.findById(TRIP_ID)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> itineraryService.getItinerary(TRIP_ID, USER_ID))
                    .isInstanceOf(TripNotFoundException.class);
        }

        @Test
        @DisplayName("throws ForbiddenException for non-participant")
        void throwsForNonParticipant() {
            when(tripRepository.findById(TRIP_ID)).thenReturn(Optional.of(trip));
            when(participantRepository.findByTripIdAndUserId(TRIP_ID, USER_ID))
                    .thenReturn(Optional.empty());

            assertThatThrownBy(() -> itineraryService.getItinerary(TRIP_ID, USER_ID))
                    .isInstanceOf(ForbiddenException.class);
        }
    }

    @Nested
    @DisplayName("updateItinerary")
    class UpdateItinerary {

        private UpdateItineraryRequest buildRequest() {
            ActivityRequest activityReq = new ActivityRequest(
                    "Walk La Rambla", null, "La Rambla, Barcelona",
                    LocalTime.of(16, 0), LocalTime.of(18, 0),
                    "SIGHTSEEING", null, new java.math.BigDecimal("18.50"), "EUR");
            DayPlanRequest dayPlanReq = new DayPlanRequest(
                    1, LocalDate.of(2026, 7, 1), "Day One", List.of(activityReq));
            return new UpdateItineraryRequest(List.of(dayPlanReq));
        }

        @Test
        @DisplayName("creates new itinerary if none exists")
        void createsNewItinerary() {
            UpdateItineraryRequest request = buildRequest();

            Itinerary newItinerary = Itinerary.builder().trip(trip).build();
            newItinerary.setId(UUID.randomUUID());
            Instant now = Instant.now();
            newItinerary.setCreatedAt(now);
            newItinerary.setUpdatedAt(now);

            DayPlan savedDayPlan = DayPlan.builder()
                    .itinerary(newItinerary)
                    .dayNumber(1)
                    .date(LocalDate.of(2026, 7, 1))
                    .title("Day One")
                    .build();
            savedDayPlan.setId(UUID.randomUUID());

            Activity savedActivity = Activity.builder()
                    .dayPlan(savedDayPlan)
                    .title("Walk La Rambla")
                    .location("La Rambla, Barcelona")
                    .startTime(LocalTime.of(16, 0))
                    .endTime(LocalTime.of(18, 0))
                    .category(ActivityCategory.SIGHTSEEING)
                    .orderIndex(0)
                    .build();

            when(tripRepository.findById(TRIP_ID)).thenReturn(Optional.of(trip));
            when(participantRepository.findByTripIdAndUserId(TRIP_ID, USER_ID))
                    .thenReturn(Optional.of(participant(ParticipantRole.OWNER)));
            when(itineraryRepository.findByTripId(TRIP_ID)).thenReturn(Optional.empty());
            when(itineraryRepository.save(any(Itinerary.class))).thenReturn(newItinerary);
            when(dayPlanRepository.findByItineraryIdOrderByDayNumberAsc(newItinerary.getId()))
                    .thenReturn(Collections.emptyList())  // during delete phase
                    .thenReturn(List.of(savedDayPlan));     // during response building
            when(dayPlanRepository.save(any(DayPlan.class))).thenReturn(savedDayPlan);
            when(activityRepository.save(any(Activity.class))).thenReturn(savedActivity);
            when(activityRepository.findByDayPlanIdOrderByOrderIndexAsc(savedDayPlan.getId()))
                    .thenReturn(List.of(savedActivity));

            ItineraryResponse response = itineraryService.updateItinerary(TRIP_ID, request, USER_ID);

            assertThat(response.tripId()).isEqualTo(TRIP_ID);
            assertThat(response.dayPlans()).hasSize(1);
            assertThat(response.dayPlans().get(0).activities()).hasSize(1);
            assertThat(response.dayPlans().get(0).activities().get(0).title())
                    .isEqualTo("Walk La Rambla");
        }

        @Test
        @DisplayName("replaces existing itinerary content")
        void replacesExistingItinerary() {
            UpdateItineraryRequest request = buildRequest();

            Itinerary existingItinerary = Itinerary.builder().trip(trip).build();
            existingItinerary.setId(UUID.randomUUID());
            existingItinerary.setCreatedAt(Instant.now());
            existingItinerary.setUpdatedAt(Instant.now());

            DayPlan oldDayPlan = DayPlan.builder()
                    .itinerary(existingItinerary)
                    .dayNumber(1)
                    .title("Old Day")
                    .build();
            oldDayPlan.setId(UUID.randomUUID());

            DayPlan newDayPlan = DayPlan.builder()
                    .itinerary(existingItinerary)
                    .dayNumber(1)
                    .date(LocalDate.of(2026, 7, 1))
                    .title("Day One")
                    .build();
            newDayPlan.setId(UUID.randomUUID());

            Activity newActivity = Activity.builder()
                    .dayPlan(newDayPlan)
                    .title("Walk La Rambla")
                    .category(ActivityCategory.SIGHTSEEING)
                    .orderIndex(0)
                    .build();

            when(tripRepository.findById(TRIP_ID)).thenReturn(Optional.of(trip));
            when(participantRepository.findByTripIdAndUserId(TRIP_ID, USER_ID))
                    .thenReturn(Optional.of(participant(ParticipantRole.EDITOR)));
            when(itineraryRepository.findByTripId(TRIP_ID))
                    .thenReturn(Optional.of(existingItinerary));
            when(dayPlanRepository.findByItineraryIdOrderByDayNumberAsc(existingItinerary.getId()))
                    .thenReturn(List.of(oldDayPlan))    // during delete phase
                    .thenReturn(List.of(newDayPlan));    // during response building
            when(itineraryRepository.save(existingItinerary)).thenReturn(existingItinerary);
            when(dayPlanRepository.save(any(DayPlan.class))).thenReturn(newDayPlan);
            when(activityRepository.save(any(Activity.class))).thenReturn(newActivity);
            when(activityRepository.findByDayPlanIdOrderByOrderIndexAsc(newDayPlan.getId()))
                    .thenReturn(List.of(newActivity));

            ItineraryResponse response = itineraryService.updateItinerary(TRIP_ID, request, USER_ID);

            verify(activityRepository).deleteAllByDayPlanId(oldDayPlan.getId());
            verify(dayPlanRepository).deleteAll(List.of(oldDayPlan));
            assertThat(response.dayPlans()).hasSize(1);
        }

        @Test
        @DisplayName("EDITOR can update itinerary")
        void editorCanUpdate() {
            UpdateItineraryRequest request = new UpdateItineraryRequest(Collections.emptyList());
            Itinerary itinerary = Itinerary.builder().trip(trip).build();
            itinerary.setId(UUID.randomUUID());
            itinerary.setCreatedAt(Instant.now());
            itinerary.setUpdatedAt(Instant.now());

            when(tripRepository.findById(TRIP_ID)).thenReturn(Optional.of(trip));
            when(participantRepository.findByTripIdAndUserId(TRIP_ID, USER_ID))
                    .thenReturn(Optional.of(participant(ParticipantRole.EDITOR)));
            when(itineraryRepository.findByTripId(TRIP_ID))
                    .thenReturn(Optional.of(itinerary));
            when(dayPlanRepository.findByItineraryIdOrderByDayNumberAsc(itinerary.getId()))
                    .thenReturn(Collections.emptyList());
            when(itineraryRepository.save(itinerary)).thenReturn(itinerary);

            ItineraryResponse response = itineraryService.updateItinerary(TRIP_ID, request, USER_ID);

            assertThat(response.dayPlans()).isEmpty();
        }

        @Test
        @DisplayName("VIEWER (accepted) can update itinerary since all participants allowed")
        void viewerCanUpdate() {
            UpdateItineraryRequest request = new UpdateItineraryRequest(Collections.emptyList());
            Itinerary itinerary = Itinerary.builder().trip(trip).build();
            itinerary.setId(UUID.randomUUID());

            when(tripRepository.findById(TRIP_ID)).thenReturn(Optional.of(trip));
            when(participantRepository.findByTripIdAndUserId(TRIP_ID, USER_ID))
                    .thenReturn(Optional.of(participant(ParticipantRole.VIEWER)));
            when(itineraryRepository.findByTripId(TRIP_ID))
                    .thenReturn(Optional.of(itinerary));
            when(dayPlanRepository.findByItineraryIdOrderByDayNumberAsc(itinerary.getId()))
                    .thenReturn(Collections.emptyList());
            when(itineraryRepository.save(any())).thenReturn(itinerary);

            ItineraryResponse response = itineraryService.updateItinerary(TRIP_ID, request, USER_ID);
            assertThat(response).isNotNull();
        }

        @Test
        @DisplayName("throws TripNotFoundException for unknown trip")
        void throwsForUnknownTrip() {
            UpdateItineraryRequest request = new UpdateItineraryRequest(Collections.emptyList());
            when(tripRepository.findById(TRIP_ID)).thenReturn(Optional.empty());

            assertThatThrownBy(
                    () -> itineraryService.updateItinerary(TRIP_ID, request, USER_ID))
                    .isInstanceOf(TripNotFoundException.class);
        }
    }

    @Nested
    @DisplayName("status auto-transition on itinerary save")
    class StatusTransition {

        private ActivityRequest act(String title) {
            return new ActivityRequest(title, null, null, null, null, "SIGHTSEEING", null, null, null);
        }

        private DayPlanRequest day(int dayNumber, ActivityRequest... activities) {
            return new DayPlanRequest(dayNumber, LocalDate.of(2026, 7, dayNumber),
                    "Day " + dayNumber, List.of(activities));
        }

        private UpdateItineraryRequest request(DayPlanRequest... days) {
            return new UpdateItineraryRequest(List.of(days));
        }

        /** Stubs enough persistence for updateItinerary to run to completion. */
        private void stubPersistence() {
            Itinerary itinerary = Itinerary.builder().trip(trip).build();
            itinerary.setId(UUID.randomUUID());
            when(tripRepository.findById(TRIP_ID)).thenReturn(Optional.of(trip));
            when(participantRepository.findByTripIdAndUserId(TRIP_ID, USER_ID))
                    .thenReturn(Optional.of(participant(ParticipantRole.OWNER)));
            when(itineraryRepository.findByTripId(TRIP_ID)).thenReturn(Optional.of(itinerary));
            when(itineraryRepository.save(any(Itinerary.class))).thenReturn(itinerary);
            when(dayPlanRepository.findByItineraryIdOrderByDayNumberAsc(itinerary.getId()))
                    .thenReturn(Collections.emptyList());
            lenient().when(dayPlanRepository.save(any(DayPlan.class))).thenAnswer(inv -> {
                DayPlan d = inv.getArgument(0);
                if (d.getId() == null) {
                    d.setId(UUID.randomUUID());
                }
                return d;
            });
            lenient().when(activityRepository.save(any(Activity.class)))
                    .thenAnswer(inv -> inv.getArgument(0));
        }

        @Test
        @DisplayName("promotes DRAFT → PLANNED when two days each have an activity")
        void promotesWhenTwoDaysHaveActivities() {
            trip.setStatus(TripStatus.DRAFT);
            stubPersistence();

            itineraryService.updateItinerary(TRIP_ID,
                    request(day(1, act("Museum")), day(2, act("Beach"))), USER_ID);

            assertThat(trip.getStatus()).isEqualTo(TripStatus.PLANNED);
            verify(tripRepository).save(trip);
        }

        @Test
        @DisplayName("promotes DRAFT → PLANNED when a single day has multiple activities")
        void promotesWhenOneDayHasMultipleActivities() {
            trip.setStatus(TripStatus.DRAFT);
            stubPersistence();

            itineraryService.updateItinerary(TRIP_ID,
                    request(day(1, act("Breakfast"), act("City tour"))), USER_ID);

            assertThat(trip.getStatus()).isEqualTo(TripStatus.PLANNED);
            verify(tripRepository).save(trip);
        }

        @Test
        @DisplayName("keeps DRAFT when only one day has one activity")
        void keepsDraftWhenSingleDaySingleActivity() {
            trip.setStatus(TripStatus.DRAFT);
            stubPersistence();

            itineraryService.updateItinerary(TRIP_ID, request(day(1, act("Museum"))), USER_ID);

            assertThat(trip.getStatus()).isEqualTo(TripStatus.DRAFT);
            verify(tripRepository, never()).save(any(Trip.class));
        }

        @Test
        @DisplayName("keeps DRAFT when there are no activities on any day")
        void keepsDraftWhenNoActivities() {
            trip.setStatus(TripStatus.DRAFT);
            stubPersistence();

            itineraryService.updateItinerary(TRIP_ID,
                    new UpdateItineraryRequest(Collections.emptyList()), USER_ID);

            assertThat(trip.getStatus()).isEqualTo(TripStatus.DRAFT);
            verify(tripRepository, never()).save(any(Trip.class));
        }

        @Test
        @DisplayName("does not count blank-titled activities toward the threshold")
        void ignoresBlankTitledActivities() {
            trip.setStatus(TripStatus.DRAFT);
            stubPersistence();

            itineraryService.updateItinerary(TRIP_ID,
                    request(day(1, act("   ")), day(2, act(""))), USER_ID);

            assertThat(trip.getStatus()).isEqualTo(TripStatus.DRAFT);
            verify(tripRepository, never()).save(any(Trip.class));
        }

        @Test
        @DisplayName("demotes PLANNED → DRAFT when the itinerary drops below the threshold")
        void demotesWhenItineraryClearedBelowThreshold() {
            trip.setStatus(TripStatus.PLANNED);
            stubPersistence();

            itineraryService.updateItinerary(TRIP_ID, request(day(1, act("Museum"))), USER_ID);

            assertThat(trip.getStatus()).isEqualTo(TripStatus.DRAFT);
            verify(tripRepository).save(trip);
        }

        @Test
        @DisplayName("leaves ONGOING status untouched even when the itinerary qualifies")
        void leavesOngoingUnchanged() {
            trip.setStatus(TripStatus.ONGOING);
            stubPersistence();

            itineraryService.updateItinerary(TRIP_ID,
                    request(day(1, act("Museum")), day(2, act("Beach"))), USER_ID);

            assertThat(trip.getStatus()).isEqualTo(TripStatus.ONGOING);
            verify(tripRepository, never()).save(any(Trip.class));
        }
    }
}
