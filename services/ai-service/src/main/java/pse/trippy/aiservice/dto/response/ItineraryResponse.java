package pse.trippy.aiservice.dto.response;

import com.fasterxml.jackson.annotation.JsonAlias;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ItineraryResponse {

    private UUID generationId;
    private String tripTitle;
    private String summary;
    private String totalEstimatedCost;
    private List<DayPlan> dailyPlan;
    private List<String> packingTips;
    private List<String> travelTips;
    private Instant generatedAt;
    private Integer tokensUsed;
    private Boolean fallbackUsed;
    private String fallbackReason;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class DayPlan {
        private Integer dayNumber;
        private String date;
        private String title;
        private WeatherSummary weather;
        private List<TransportRecommendation> transportRecommendations;
        private List<Activity> activities;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class WeatherSummary {
        private String condition;
        private Double temperatureCelsius;
        private String advice;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class TransportRecommendation {
        private String from;
        private String to;
        private String mode;
        private String estimatedDuration;
        private String notes;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Activity {
        private String time;
        @JsonAlias("duration")
        private Integer durationMinutes;
        private String title;
        private String description;
        private String location;
        private String googleMapsUrl;
        private String category; // SIGHTSEEING, FOOD, TRANSPORT, ACCOMMODATION, ACTIVITY, FREE_TIME
        private String estimatedCost;
        private String tips;
        private Boolean bookingRequired;
        private Double lat;
        private Double lng;
        private String weatherCondition;
        private Double weatherTemp;
        private Boolean isRainy;
    }
}
