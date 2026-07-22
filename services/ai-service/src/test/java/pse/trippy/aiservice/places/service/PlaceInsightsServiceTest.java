package pse.trippy.aiservice.places.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import pse.trippy.aiservice.places.dto.PlaceInsightsRequest;
import pse.trippy.aiservice.places.dto.PlaceInsightsRequest.PlaceRef;
import pse.trippy.aiservice.places.dto.PlaceInsightsResponse;
import pse.trippy.aiservice.places.dto.PlaceRankRequest;
import pse.trippy.aiservice.places.dto.PlaceRankRequest.RankPlace;
import pse.trippy.aiservice.places.dto.PlaceRankResponse;
import pse.trippy.aiservice.recommendation.service.OllamaRecommendationClient;

import java.time.Duration;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@DisplayName("PlaceInsightsService")
class PlaceInsightsServiceTest {

    @Mock
    private OllamaRecommendationClient ollama;

    private PlaceInsightsService service;

    @BeforeEach
    void setUp() {
        service = new PlaceInsightsService(ollama, new ObjectMapper());
        lenient().when(ollama.model()).thenReturn("llama3.2:3b");
    }

    private PlaceInsightsRequest insightsRequest() {
        return new PlaceInsightsRequest(List.of(
                new PlaceRef("p1", "Café Central", "cafe", "Marktplatz 1, Ludwigsburg"),
                new PlaceRef("p2", "Kaffeehaus Blau", "cafe", "Bahnhofstr. 4, Ludwigsburg")));
    }

    private PlaceRankRequest rankRequest() {
        return new PlaceRankRequest("coffee shops near ludwigsburg", List.of(
                new RankPlace("p1", "Café Central", "cafe", null, 4.6, 210, List.of("Great flat white")),
                new RankPlace("p2", "Kaffeehaus Blau", "cafe", null, 4.1, 80, List.of("Cosy corner spot")),
                new RankPlace("p3", "Bohnenwerk", "cafe", null, 4.8, 340, null)));
    }

    @Nested
    @DisplayName("insights")
    class Insights {

        @Test
        @DisplayName("returns model-generated reviews keyed by the request ids")
        void modelPath() {
            when(ollama.isEnabled()).thenReturn(true);
            when(ollama.chatJson(anyString(), anyString(), any(Duration.class))).thenReturn("""
                    {"places":[
                      {"id":"p1","rating":4.5,"reviewCount":230,"reviews":[
                        {"author":"Lena","rating":5,"when":"2 weeks ago","text":"Best flat white in town."},
                        {"author":"Marc","rating":4,"when":"1 month ago","text":"Cosy, can get busy."}]},
                      {"id":"p2","rating":4.1,"reviewCount":88,"reviews":[
                        {"author":"Ida","rating":4,"when":"3 weeks ago","text":"Nice cakes, slow service."},
                        {"author":"Tom","rating":5,"when":"2 months ago","text":"Hidden gem near the station."}]}
                    ]}
                    """);

            PlaceInsightsResponse res = service.insights(insightsRequest());

            assertThat(res.source()).isEqualTo("AI");
            assertThat(res.places()).hasSize(2);
            assertThat(res.places().get(0).id()).isEqualTo("p1");
            assertThat(res.places().get(0).rating()).isEqualTo(4.5);
            assertThat(res.places().get(0).reviews()).hasSize(2);
        }

        @Test
        @DisplayName("falls back per-place when the model omits a place")
        void partialModelResponse() {
            when(ollama.isEnabled()).thenReturn(true);
            when(ollama.chatJson(anyString(), anyString(), any(Duration.class))).thenReturn("""
                    {"places":[{"id":"p1","rating":4.5,"reviewCount":230,"reviews":[
                      {"author":"Lena","rating":5,"when":"2 weeks ago","text":"Great."}]}]}
                    """);

            PlaceInsightsResponse res = service.insights(insightsRequest());

            assertThat(res.places()).hasSize(2);
            assertThat(res.places().get(1).id()).isEqualTo("p2");
            assertThat(res.places().get(1).reviews()).isNotEmpty();
        }

        @Test
        @DisplayName("returns deterministic fallback when Ollama is disabled")
        void disabledFallback() {
            when(ollama.isEnabled()).thenReturn(false);

            PlaceInsightsResponse first = service.insights(insightsRequest());
            PlaceInsightsResponse second = service.insights(insightsRequest());

            assertThat(first.source()).isEqualTo("FALLBACK");
            assertThat(first.places()).hasSize(2);
            assertThat(first.places().get(0).rating())
                    .isEqualTo(second.places().get(0).rating());
        }

        @Test
        @DisplayName("falls back on malformed model output")
        void malformedFallback() {
            when(ollama.isEnabled()).thenReturn(true);
            when(ollama.chatJson(anyString(), anyString(), any(Duration.class)))
                    .thenReturn("not json at all");

            PlaceInsightsResponse res = service.insights(insightsRequest());

            assertThat(res.source()).isEqualTo("FALLBACK");
            assertThat(res.places()).hasSize(2);
        }
    }

    @Nested
    @DisplayName("rank")
    class Rank {

        @Test
        @DisplayName("returns model ranking with names resolved from the request")
        void modelPath() {
            when(ollama.isEnabled()).thenReturn(true);
            when(ollama.chatJson(anyString(), anyString(), any(Duration.class))).thenReturn("""
                    {"summary":"Bohnenwerk edges it for coffee quality.",
                     "rankings":[
                       {"id":"p3","rank":1,"reason":"Highest rated with rave espresso snippets."},
                       {"id":"p1","rank":2,"reason":"Strong all-rounder with 210 reviews."},
                       {"id":"p2","rank":3,"reason":"Cosy but slower service per reviews."}]}
                    """);

            PlaceRankResponse res = service.rank(rankRequest());

            assertThat(res.source()).isEqualTo("AI");
            assertThat(res.rankings()).hasSize(3);
            assertThat(res.rankings().get(0).placeId()).isEqualTo("p3");
            assertThat(res.rankings().get(0).rank()).isEqualTo(1);
            assertThat(res.rankings().get(0).name()).isEqualTo("Bohnenwerk");
        }

        @Test
        @DisplayName("ignores rankings for unknown ids and re-numbers the rest")
        void unknownIdsSkipped() {
            when(ollama.isEnabled()).thenReturn(true);
            when(ollama.chatJson(anyString(), anyString(), any(Duration.class))).thenReturn("""
                    {"rankings":[
                       {"id":"ghost","rank":1,"reason":"Should be dropped."},
                       {"id":"p1","rank":2,"reason":"Valid entry."}]}
                    """);

            PlaceRankResponse res = service.rank(rankRequest());

            assertThat(res.rankings()).hasSize(1);
            assertThat(res.rankings().get(0).placeId()).isEqualTo("p1");
            assertThat(res.rankings().get(0).rank()).isEqualTo(1);
        }

        @Test
        @DisplayName("falls back to rating-sorted top 3 when the model fails")
        void fallbackRanksByRating() {
            when(ollama.isEnabled()).thenReturn(true);
            when(ollama.chatJson(anyString(), anyString(), any(Duration.class)))
                    .thenThrow(new RuntimeException("ollama down"));

            PlaceRankResponse res = service.rank(rankRequest());

            assertThat(res.source()).isEqualTo("FALLBACK");
            assertThat(res.rankings()).hasSize(3);
            assertThat(res.rankings().get(0).placeId()).isEqualTo("p3"); // 4.8 top
            assertThat(res.rankings().get(1).placeId()).isEqualTo("p1"); // 4.6
        }
    }
}
