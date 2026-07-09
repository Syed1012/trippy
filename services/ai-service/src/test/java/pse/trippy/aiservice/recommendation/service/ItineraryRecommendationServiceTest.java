package pse.trippy.aiservice.recommendation.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import pse.trippy.aiservice.recommendation.dto.RecommendationRequest;
import pse.trippy.aiservice.recommendation.dto.RecommendationResponse;
import pse.trippy.aiservice.recommendation.model.ItineraryRecommendation;

import java.math.BigDecimal;
import java.time.Duration;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@DisplayName("ItineraryRecommendationService")
class ItineraryRecommendationServiceTest {

    @Mock
    private OllamaRecommendationClient ollama;

    @Mock
    private RecommendationPersistence persistence;

    private ItineraryRecommendationService service;

    @BeforeEach
    void setUp() {
        service = new ItineraryRecommendationService(ollama, persistence, new ObjectMapper());
    }

    private RecommendationRequest wholeTrip(UUID tripId, int days) {
        return new RecommendationRequest(tripId, "Paris, France", days, null, null, null);
    }

    private String aiJsonForDays(int... days) {
        StringBuilder sb = new StringBuilder("{\"days\":[");
        for (int i = 0; i < days.length; i++) {
            if (i > 0) sb.append(',');
            sb.append("{\"dayNumber\":").append(days[i]).append(",\"options\":[")
                    .append(option("Louvre & Seine", "09:00", "17:00", 80))
                    .append(',').append(option("Montmartre climb", "08:00", "18:00", 40))
                    .append(',').append(option("Hidden Marais cafes", "10:00", "20:00", 30))
                    .append("]}");
        }
        return sb.append("]}").toString();
    }

    private String option(String title, String start, String end, int cost) {
        return "{\"title\":\"" + title + "\",\"startTime\":\"" + start + "\",\"endTime\":\"" + end
                + "\",\"estimatedCost\":" + cost + ",\"currency\":\"EUR\",\"notes\":\"Great day.\",\"mapsQuery\":\""
                + title + "\"}";
    }

    @Test
    @DisplayName("whole-trip generation with a valid model response → AI source, 3 vibes per day, persisted")
    void generate_wholeTrip_aiSuccess() throws Exception {
        UUID tripId = UUID.randomUUID();
        when(ollama.isEnabled()).thenReturn(true);
        when(ollama.model()).thenReturn("llama3.2:3b");
        when(ollama.chatJson(anyString(), anyString(), any(Duration.class))).thenReturn(aiJsonForDays(1, 2));

        RecommendationResponse response = service.generate(wholeTrip(tripId, 2));

        assertThat(response.source()).isEqualTo("AI");
        assertThat(response.model()).isEqualTo("llama3.2:3b");
        assertThat(response.days()).hasSize(2);
        assertThat(response.days().get(0).options()).hasSize(3);
        assertThat(response.days().get(0).options())
                .extracting(RecommendationResponse.RecommendationOption::vibe)
                .containsExactly("Top Pick", "Adventurer", "Hidden Gem");
        assertThat(response.days().get(0).options().get(0).mapsUrl())
                .startsWith("https://www.google.com/maps/search/");
        verify(persistence).replaceForTrip(eq(tripId), any());
        verify(persistence, never()).replaceForDay(any(), anyInt(), any());
    }

    @Test
    @DisplayName("whole-trip generation falls back to templates when Ollama fails")
    void generate_wholeTrip_ollamaFails_usesFallback() throws Exception {
        UUID tripId = UUID.randomUUID();
        when(ollama.isEnabled()).thenReturn(true);
        when(ollama.model()).thenReturn("llama3.2:3b");
        when(ollama.chatJson(anyString(), anyString(), any(Duration.class)))
                .thenThrow(new OllamaRecommendationClient.RecommendationClientException("request timed out"));

        RecommendationResponse response = service.generate(wholeTrip(tripId, 3));

        assertThat(response.source()).isEqualTo("FALLBACK");
        assertThat(response.model()).isEqualTo("fallback");
        assertThat(response.days()).hasSize(3);
        assertThat(response.days().get(0).options()).hasSize(3);
        verify(persistence).replaceForTrip(eq(tripId), any());
    }

    @Test
    @DisplayName("disabled client skips the model call and uses the fallback")
    void generate_disabled_usesFallback() throws Exception {
        UUID tripId = UUID.randomUUID();
        when(ollama.isEnabled()).thenReturn(false);
        when(ollama.model()).thenReturn("llama3.2:3b");

        RecommendationResponse response = service.generate(wholeTrip(tripId, 1));

        assertThat(response.source()).isEqualTo("FALLBACK");
        verify(ollama, never()).chatJson(anyString(), anyString(), any(Duration.class));
        verify(persistence).replaceForTrip(eq(tripId), any());
    }

    @Test
    @DisplayName("single-day request regenerates only that day and replaces just that day")
    void generate_singleDay_replacesThatDay() throws Exception {
        UUID tripId = UUID.randomUUID();
        when(ollama.isEnabled()).thenReturn(true);
        when(ollama.model()).thenReturn("llama3.2:3b");
        when(ollama.chatJson(anyString(), anyString(), any(Duration.class))).thenReturn(aiJsonForDays(3));

        RecommendationRequest request = new RecommendationRequest(tripId, "Paris, France", 5, 3, null, null);
        RecommendationResponse response = service.generate(request);

        assertThat(response.days()).hasSize(1);
        assertThat(response.days().get(0).dayNumber()).isEqualTo(3);
        verify(persistence).replaceForDay(eq(tripId), eq(3), any());
        verify(persistence, never()).replaceForTrip(any(), any());
    }

    @Test
    @DisplayName("a persistence failure never fails the request")
    void generate_persistenceFailure_stillReturnsRecommendations() throws Exception {
        UUID tripId = UUID.randomUUID();
        when(ollama.isEnabled()).thenReturn(true);
        when(ollama.model()).thenReturn("llama3.2:3b");
        when(ollama.chatJson(anyString(), anyString(), any(Duration.class))).thenReturn(aiJsonForDays(1));
        doThrow(new RuntimeException("db down")).when(persistence).replaceForTrip(any(), any());

        RecommendationResponse[] holder = new RecommendationResponse[1];
        assertThatCode(() -> holder[0] = service.generate(wholeTrip(tripId, 1))).doesNotThrowAnyException();
        assertThat(holder[0].days()).hasSize(1);
        assertThat(holder[0].source()).isEqualTo("AI");
    }

    @Test
    @DisplayName("a null trip id skips persistence entirely")
    void generate_nullTripId_skipsPersistence() throws Exception {
        when(ollama.isEnabled()).thenReturn(true);
        when(ollama.model()).thenReturn("llama3.2:3b");
        when(ollama.chatJson(anyString(), anyString(), any(Duration.class))).thenReturn(aiJsonForDays(1));

        RecommendationResponse response = service.generate(wholeTrip(null, 1));

        assertThat(response.days()).hasSize(1);
        verify(persistence, never()).replaceForTrip(any(), any());
        verify(persistence, never()).replaceForDay(any(), anyInt(), any());
    }

    @Test
    @DisplayName("getStored groups stored rows by day")
    void getStored_groupsByDay() {
        UUID tripId = UUID.randomUUID();
        when(persistence.findForTrip(tripId)).thenReturn(List.of(
                storedRow(tripId, 1, 0, "Top Pick", "Louvre"),
                storedRow(tripId, 1, 1, "Adventurer", "Montmartre"),
                storedRow(tripId, 2, 0, "Top Pick", "Versailles")));

        RecommendationResponse response = service.getStored(tripId);

        assertThat(response.days()).hasSize(2);
        assertThat(response.days().get(0).dayNumber()).isEqualTo(1);
        assertThat(response.days().get(0).options()).hasSize(2);
        assertThat(response.days().get(1).options()).hasSize(1);
        assertThat(response.source()).isEqualTo("AI");
    }

    @Test
    @DisplayName("getStored returns an empty response when nothing is stored")
    void getStored_empty() {
        UUID tripId = UUID.randomUUID();
        when(persistence.findForTrip(tripId)).thenReturn(List.of());

        RecommendationResponse response = service.getStored(tripId);

        assertThat(response.days()).isEmpty();
        assertThat(response.source()).isNull();
    }

    private ItineraryRecommendation storedRow(UUID tripId, int day, int index, String vibe, String title) {
        return ItineraryRecommendation.builder()
                .id(UUID.randomUUID())
                .tripId(tripId)
                .dayNumber(day)
                .optionIndex(index)
                .vibe(vibe)
                .title(title)
                .startTime("09:00")
                .endTime("18:00")
                .estimatedCost(BigDecimal.valueOf(75))
                .currency("EUR")
                .mapsUrl("https://maps.example/" + title)
                .notes("Stored note")
                .model("llama3.2:3b")
                .source("AI")
                .build();
    }
}
