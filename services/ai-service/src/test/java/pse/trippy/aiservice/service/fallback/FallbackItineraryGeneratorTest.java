package pse.trippy.aiservice.service.fallback;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import pse.trippy.aiservice.dto.request.GenerateItineraryRequest;
import pse.trippy.aiservice.dto.request.TripConstraints;
import pse.trippy.aiservice.dto.response.ItineraryResponse;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@DisplayName("FallbackItineraryGenerator")
class FallbackItineraryGeneratorTest {

    private FallbackItineraryGenerator generator;

    @BeforeEach
    void setUp() {
        FallbackDestinationCatalogue catalogue = new FallbackDestinationCatalogue(new ObjectMapper());
        generator = new FallbackItineraryGenerator(catalogue);
    }

    @Test
    @DisplayName("generates the exact requested number of days")
    void generatesExactRequestedDayCount() {
        ItineraryResponse response = generator.generate(request("Paris, France", 7, "MODERATE",
                List.of(), List.of()), "AI_PROVIDER_UNAVAILABLE");

        assertThat(response.getDailyPlan()).hasSize(7);
        assertThat(response.getDailyPlan().get(0).getDayNumber()).isEqualTo(1);
        assertThat(response.getDailyPlan().get(6).getDayNumber()).isEqualTo(7);
    }

    @Test
    @DisplayName("1-day, 3-day and 7-day generation succeeds for supported destinations")
    void supportsRequiredTripLengths() {
        assertThat(generator.generate(request("Munich", 1, "MODERATE", List.of(), List.of()),
                "AI_PROVIDER_UNAVAILABLE").getDailyPlan()).hasSize(1);
        assertThat(generator.generate(request("Berlin", 3, "MODERATE", List.of(), List.of()),
                "AI_PROVIDER_UNAVAILABLE").getDailyPlan()).hasSize(3);
        assertThat(generator.generate(request("Kyoto", 7, "MODERATE", List.of(), List.of()),
                "AI_PROVIDER_UNAVAILABLE").getDailyPlan()).hasSize(7);
    }

    @Test
    @DisplayName("1-day trips do not include day trips")
    void oneDayTripsDoNotIncludeDayTrips() {
        ItineraryResponse response = generator.generate(request("Queenstown", 1, "PACKED",
                List.of(), List.of()), "AI_PROVIDER_UNAVAILABLE");

        assertThat(activityTitles(response))
                .noneMatch(title -> title.toLowerCase().contains("day trip"));
    }

    @Test
    @DisplayName("SLOW, MODERATE and PACKED pace affect daily activity count")
    void paceAffectsDailyActivityCount() {
        int slowCount = totalActivities(generator.generate(request("Berlin", 3, "SLOW",
                List.of(), List.of()), "AI_PROVIDER_UNAVAILABLE"));
        int moderateCount = totalActivities(generator.generate(request("Berlin", 3, "MODERATE",
                List.of(), List.of()), "AI_PROVIDER_UNAVAILABLE"));
        int packedCount = totalActivities(generator.generate(request("Berlin", 3, "PACKED",
                List.of(), List.of()), "AI_PROVIDER_UNAVAILABLE"));

        assertThat(slowCount).isGreaterThanOrEqualTo(15);
        assertThat(moderateCount).isGreaterThanOrEqualTo(15);
        assertThat(packedCount).isGreaterThanOrEqualTo(moderateCount);
    }

    @Test
    @DisplayName("generates at least five activities for every fallback day")
    void generatesAtLeastFiveActivitiesPerDay() {
        ItineraryResponse response = generator.generate(request("Berlin", 3, "SLOW",
                List.of(), List.of()), "AI_PROVIDER_UNAVAILABLE");

        assertThat(response.getDailyPlan())
                .allSatisfy(day -> assertThat(day.getActivities()).hasSizeGreaterThanOrEqualTo(5));
    }

    @Test
    @DisplayName("must-see and avoid attractions are applied")
    void appliesMustSeeAndAvoidAttractions() {
        ItineraryResponse response = generator.generate(request("Berlin", 3, "MODERATE",
                List.of("Museum Island"), List.of("Brandenburg Gate")), "AI_PROVIDER_UNAVAILABLE");

        assertThat(activityTitles(response)).contains("Museum Island");
        assertThat(activityTitles(response)).doesNotContain("Brandenburg Gate");
    }

    @Test
    @DisplayName("blank activity titles do not match must-see or avoid preferences")
    void blankActivityTitlesDoNotMatchPreferences() {
        FallbackDestinationProfile destination = new FallbackDestinationProfile(
                "blank-title-city",
                FallbackDestinationCatalogue.SCOPE_WORLDWIDE,
                "Blank Title City",
                "Blank Title City",
                "Testland",
                "City",
                List.of("blank-title-city"),
                List.of("testing"),
                List.of("Fallback fixture"),
                "Fixture destination",
                List.of("Fallback fixture"),
                BigDecimal.valueOf(100),
                "Spring",
                List.of(4, 5),
                List.of("testing"),
                List.of("MODERATE"),
                1,
                1,
                1,
                List.of(new FallbackActivity(
                        "blank-title-activity",
                        "",
                        "Intentional blank title",
                        "Blank Title City",
                        "testing",
                        "MUST_SEE",
                        1,
                        60,
                        "EUR 10",
                        "LOW",
                        List.of("testing"),
                        "MORNING",
                        "central",
                        true,
                        false)),
                List.of(),
                List.of(),
                List.of(),
                List.of("Use this fixture for matching tests.", "Keep fallback behavior deterministic."),
                List.of("Pack normally.", "Bring comfortable shoes.")
        );
        FallbackDestinationCatalogue catalogue = new FallbackDestinationCatalogue(new ObjectMapper()) {
            @Override
            public Optional<FallbackDestinationProfile> findBestMatch(String rawInput) {
                return Optional.of(destination);
            }
        };
        FallbackItineraryGenerator blankTitleGenerator = new FallbackItineraryGenerator(catalogue);

        ItineraryResponse response = blankTitleGenerator.generate(request("Blank Title City", 1, "MODERATE",
                List.of("museum"), List.of("museum")), "AI_PROVIDER_UNAVAILABLE");

        assertThat(response.getDailyPlan().get(0).getActivities())
                .extracting(ItineraryResponse.Activity::getTitle)
                .contains("");
    }

    @Test
    @DisplayName("sets fallback metadata")
    void setsFallbackMetadata() {
        ItineraryResponse response = generator.generate(request("Prauge", 3, "MODERATE",
                List.of(), List.of()), "AI_PROVIDER_UNAVAILABLE");

        assertThat(response.getTokensUsed()).isZero();
        assertThat(response.getFallbackUsed()).isTrue();
        assertThat(response.getFallbackReason()).isEqualTo("AI_PROVIDER_UNAVAILABLE");
        assertThat(response.getTripTitle()).contains("Prague, Czechia");
    }

    @Test
    @DisplayName("includes Google Maps direction URLs for generated activities")
    void includesGoogleMapsUrls() {
        ItineraryResponse response = generator.generate(request("Berlin", 1, "MODERATE",
                List.of(), List.of()), "AI_PROVIDER_UNAVAILABLE");

        assertThat(response.getDailyPlan().get(0).getActivities())
                .allSatisfy(activity -> assertThat(activity.getGoogleMapsUrl())
                        .startsWith("https://www.google.com/maps/dir/?api=1&destination="));
    }

    @Test
    @DisplayName("rejects unsupported destinations instead of producing generic fallback plans")
    void rejectsUnsupportedDestinations() {
        assertThatThrownBy(() -> generator.generate(request("Delhi", 3, "MODERATE",
                List.of(), List.of()), "AI_PROVIDER_UNAVAILABLE"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Fallback is not available for Delhi");
    }

    private GenerateItineraryRequest request(String destination, int days, String pace,
                                             List<String> mustSee,
                                             List<String> avoid) {
        LocalDate startDate = LocalDate.of(2026, 6, 1);
        return new GenerateItineraryRequest(
                null,
                new TripConstraints(destination, startDate, startDate.plusDays(days - 1L),
                        "MODERATE", new TripConstraints.Travelers(2, 0), null),
                null,
                null,
                new GenerateItineraryRequest.ItineraryPreferences(
                        true, true, false, pace, mustSee, avoid));
    }

    private int totalActivities(ItineraryResponse response) {
        return response.getDailyPlan().stream()
                .mapToInt(day -> day.getActivities().size())
                .sum();
    }

    private List<String> activityTitles(ItineraryResponse response) {
        return response.getDailyPlan().stream()
                .flatMap(day -> day.getActivities().stream())
                .map(ItineraryResponse.Activity::getTitle)
                .toList();
    }
}
