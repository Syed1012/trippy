package pse.trippy.aiservice.image.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.List;
import java.util.Map;

/**
 * Uses the local Ollama text model (e.g. gemma) to turn a destination into a
 * vivid, single-line image-generation prompt. Kept separate from the
 * recommendation client so the two features stay independent.
 *
 * <p>Note: text models cannot render images — this only writes the prompt; the
 * actual pixels are produced by a text-to-image generator downstream.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class ImagePromptClient {

    private final ObjectMapper mapper;

    private final HttpClient http = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(8))
            .build();

    @Value("${AI_RECO_BASE_URL:http://localhost:11434}")
    private String baseUrl;

    @Value("${AI_RECO_MODEL:gemma3:4b}")
    private String model;

    public String model() {
        return model;
    }

    /** Single-turn chat that returns the assistant's plain-text reply. */
    public String craftScenePrompt(String system, String user, Duration timeout) {
        String endpoint = normalizedBaseUrl() + "/api/chat";
        Map<String, Object> payload = Map.of(
                "model", model,
                "stream", false,
                "options", Map.of("temperature", 0.8),
                "messages", List.of(
                        Map.of("role", "system", "content", system),
                        Map.of("role", "user", "content", user)
                )
        );

        try {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(endpoint))
                    .timeout(timeout)
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(mapper.writeValueAsString(payload)))
                    .build();

            HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                throw new IllegalStateException("Ollama returned status " + response.statusCode());
            }
            JsonNode root = mapper.readTree(response.body());
            return root.path("message").path("content").asText("");
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Ollama prompt request was interrupted", ex);
        } catch (Exception ex) {
            throw new IllegalStateException("Ollama prompt request failed: " + ex.getMessage(), ex);
        }
    }

    private String normalizedBaseUrl() {
        String trimmed = baseUrl == null ? "" : baseUrl.trim();
        while (trimmed.endsWith("/")) {
            trimmed = trimmed.substring(0, trimmed.length() - 1);
        }
        return trimmed.isEmpty() ? "http://localhost:11434" : trimmed;
    }
}
