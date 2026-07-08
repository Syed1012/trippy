package pse.trippy.userservice.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pse.trippy.userservice.dto.request.SaveTripPreferenceRequest;
import pse.trippy.userservice.dto.response.TripPreferenceResponse;
import pse.trippy.userservice.model.entity.TripPreference;
import pse.trippy.userservice.repository.TripPreferenceRepository;

import java.util.Optional;
import java.util.UUID;

/**
 * Service for saving and reading trip-scoped travel preferences.
 *
 * <p>Preferences are unique per {@code (userId, tripId)} pair — saving again for
 * the same trip updates the existing row rather than creating a duplicate.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class TripPreferenceService {

    private final TripPreferenceRepository tripPreferenceRepository;

    /**
     * Creates or updates the authenticated user's preferences for a trip.
     *
     * @param userId  the owning user's ID (from X-User-Id header)
     * @param request the preference fields to persist
     * @return the saved preferences
     */
    @Transactional
    public TripPreferenceResponse savePreference(UUID userId, SaveTripPreferenceRequest request) {
        TripPreference preference = tripPreferenceRepository
                .findByUserIdAndTripId(userId, request.getTripId())
                .orElseGet(() -> TripPreference.builder()
                        .userId(userId)
                        .tripId(request.getTripId())
                        .build());

        preference.setTripType(request.getTripType());
        preference.setBudgetTier(request.getBudgetTier());
        preference.setPreferredWeather(request.getPreferredWeather());
        preference.setNotes(request.getNotes());

        TripPreference saved = tripPreferenceRepository.save(preference);
        log.info("Saved trip preferences: user={} | trip={} | type={} | budget={} | weather={}",
                userId, saved.getTripId(), saved.getTripType(),
                saved.getBudgetTier(), saved.getPreferredWeather());

        return toResponse(saved);
    }

    /**
     * Returns the authenticated user's preferences for a trip, if any.
     *
     * @param userId the owning user's ID (from X-User-Id header)
     * @param tripId the trip to look up
     * @return the preferences, or empty if none have been saved
     */
    @Transactional(readOnly = true)
    public Optional<TripPreferenceResponse> getPreference(UUID userId, UUID tripId) {
        return tripPreferenceRepository
                .findByUserIdAndTripId(userId, tripId)
                .map(this::toResponse);
    }

    private TripPreferenceResponse toResponse(TripPreference preference) {
        return TripPreferenceResponse.builder()
                .preferenceId(preference.getId())
                .userId(preference.getUserId())
                .tripId(preference.getTripId())
                .tripType(preference.getTripType())
                .budgetTier(preference.getBudgetTier())
                .preferredWeather(preference.getPreferredWeather())
                .notes(preference.getNotes())
                .createdAt(preference.getCreatedAt())
                .updatedAt(preference.getUpdatedAt())
                .build();
    }
}
