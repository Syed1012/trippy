package pse.trippy.aiservice.recommendation.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.List;
import java.util.Map;

/**
 * Thin, self-contained client for a local <a href="https://ollama.com">Ollama</a>
 * instance. Uses the native {@code /api/chat} endpoint with {@code format=json}
 * so small models (e.g. {@code gemma3:4b}) return parseable JSON.
 *
 * <p>Deliberately does not depend on Spring AI or any existing AI beans — it is
 * configured purely from environment flags so the Groq path stays untouched.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class OllamaRecommendationClient {

    private final ObjectMapper mapper;

    private final HttpClient http = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .build();

    @Value("${AI_RECO_ENABLED:true}")
    private boolean enabled;

    @Value("${AI_RECO_BASE_URL:http://localhost:11434}")
    private String baseUrl;

    @Value("${AI_RECO_MODEL:gemma3:4b}")
    private String model;

    public boolean isEnabled() {
        return enabled;
    }

    public String model() {
        return model;
    }

    /**
     * On startup, checks whether Ollama is reachable and the configured
     * {@code AI_RECO_MODEL} is pulled, logging a single INFO line either way.
     */
    @EventListener(ApplicationReadyEvent.class)
    public void logModelAvailabilityOnStartup() {
        boolean loaded = isModelAvailable();
        log.info("Ollama check: model '{}' at {} loaded={}", model, normalizedBaseUrl(), loaded);
    }

    private boolean isModelAvailable() {
        try {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(normalizedBaseUrl() + "/api/tags"))
                    .timeout(Duration.ofSeconds(3))
                    .GET()
                    .build();
            HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                return false;
            }
            JsonNode models = mapper.readTree(response.body()).path("models");
            for (JsonNode m : models) {
                if (model.equals(m.path("name").asText())) {
                    return true;
                }
            }
            return false;
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            return false;
        } catch (Exception ex) {
            return false;
        }
    }

    /**
     * Sends a system + user prompt to Ollama and returns the assistant message
     * content, which (thanks to {@code format=json}) is a JSON document string.
     *
     * @throws RecommendationClientException on any transport, status or empty-body failure
     */
    public String chatJson(String system, String user, Duration timeout) {
        String endpoint = normalizedBaseUrl() + "/api/chat";
        Map<String, Object> payload = Map.of(
                "model", model,
                "stream", false,
                "format", "json",
                "options", Map.of("temperature", 0.7),
                "messages", List.of(
                        Map.of("role", "system", "content", system),
                        Map.of("role", "user", "content", user)
                )
        );

        try {
            String body = mapper.writeValueAsString(payload);
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(endpoint))
                    .timeout(timeout)
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(body))
                    .build();

            HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                throw new RecommendationClientException(
                        "Ollama returned status " + response.statusCode() + " from " + endpoint);
            }

            JsonNode root = mapper.readTree(response.body());
            String content = root.path("message").path("content").asText("");
            if (content.isBlank()) {
                throw new RecommendationClientException("Ollama returned an empty message content");
            }
            return content;
        } catch (RecommendationClientException ex) {
            throw ex;
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            throw new RecommendationClientException("Ollama request was interrupted", ex);
        } catch (Exception ex) {
            throw new RecommendationClientException("Ollama request failed: " + ex.getMessage(), ex);
        }
    }

    private String normalizedBaseUrl() {
        String trimmed = baseUrl == null ? "" : baseUrl.trim();
        while (trimmed.endsWith("/")) {
            trimmed = trimmed.substring(0, trimmed.length() - 1);
        }
        return trimmed.isEmpty() ? "http://localhost:11434" : trimmed;
    }

    /** Raised when Ollama is unreachable or returns an unusable response. */
    public static class RecommendationClientException extends RuntimeException {
        public RecommendationClientException(String message) {
            super(message);
        }

        public RecommendationClientException(String message, Throwable cause) {
            super(message, cause);
        }
    }
}
