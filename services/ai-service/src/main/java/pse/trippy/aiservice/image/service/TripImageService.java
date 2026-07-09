package pse.trippy.aiservice.image.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import pse.trippy.aiservice.image.dto.TripImageRequest;
import pse.trippy.aiservice.image.dto.TripImageResponse;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ThreadLocalRandom;

/**
 * Builds a trip cover image: the local model writes a vivid scene prompt, then a
 * keyless text-to-image generator (Pollinations by default) renders it. The
 * image URL is deterministic per trip so it stays stable across regenerations.
 *
 * <p>Isolated from the Groq pipeline and stateless — the resulting URL is
 * persisted onto the trip itself (trip-service {@code coverImageUrl}).
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class TripImageService {

    private static final String SYSTEM_PROMPT = """
            You write a single image-generation prompt for a beautiful travel cover photo.
            Rules: one line, max 40 words, no quotes, no preamble, no explanations.
            Name a real iconic landmark or natural scenery for the destination.
            Always describe a wide cinematic shot, golden-hour lighting, photorealistic, ultra detailed, vibrant colours.
            Output ONLY the prompt text.
            """;

    private final ImagePromptClient promptClient;

    @Value("${AI_IMAGE_ENABLED:true}")
    private boolean enabled;

    @Value("${AI_IMAGE_BASE_URL:https://image.pollinations.ai}")
    private String imageBaseUrl;

    @Value("${AI_IMAGE_MODEL:flux}")
    private String imageModel;

    @Value("${AI_IMAGE_WIDTH:1280}")
    private int width;

    @Value("${AI_IMAGE_HEIGHT:720}")
    private int height;

    public TripImageResponse generate(TripImageRequest request) {
        if (!enabled) {
            return new TripImageResponse(request.tripId(), null, null, imageModel, "DISABLED", "DISABLED");
        }

        String prompt;
        String source;
        try {
            String crafted = promptClient.craftScenePrompt(
                    SYSTEM_PROMPT, buildUserPrompt(request), Duration.ofSeconds(25));
            prompt = sanitize(crafted);
            if (prompt.isBlank()) {
                throw new IllegalStateException("empty prompt");
            }
            source = "AI";
        } catch (Exception ex) {
            log.warn("Image prompt generation failed ({}), using template", ex.getMessage());
            prompt = fallbackPrompt(request.destination());
            source = "FALLBACK";
        }

        String url = buildImageUrl(prompt, request.tripId());
        return new TripImageResponse(request.tripId(), url, prompt, imageModel, source, "READY");
    }

    private String buildUserPrompt(TripImageRequest request) {
        StringBuilder sb = new StringBuilder("Destination: ").append(request.destination().trim());
        TripImageRequest.PreferenceContext prefs = request.preferences();
        if (prefs != null) {
            List<String> parts = new ArrayList<>();
            if (isSet(prefs.tripType())) parts.add(prefs.tripType().toLowerCase() + " trip");
            if (isSet(prefs.preferredWeather())) parts.add(prefs.preferredWeather().toLowerCase() + " weather");
            if (!parts.isEmpty()) {
                sb.append(". Mood: ").append(String.join(", ", parts));
            }
        }
        sb.append(". Write the cover-photo prompt.");
        return sb.toString();
    }

    private String buildImageUrl(String prompt, UUID tripId) {
        String encoded = URLEncoder.encode(prompt, StandardCharsets.UTF_8).replace("+", "%20");
        long seed = tripId != null
                ? Math.abs(tripId.getMostSignificantBits() ^ tripId.getLeastSignificantBits()) % 1_000_000L
                : ThreadLocalRandom.current().nextLong(1_000_000L);
        return normalizedImageBaseUrl() + "/prompt/" + encoded
                + "?width=" + width
                + "&height=" + height
                + "&nologo=true"
                + "&seed=" + seed
                + "&model=" + URLEncoder.encode(imageModel, StandardCharsets.UTF_8);
    }

    private String fallbackPrompt(String destination) {
        return destination.trim()
                + ", iconic landmark, scenic travel photography, wide cinematic shot, "
                + "golden hour lighting, photorealistic, ultra detailed, vibrant colours, high resolution";
    }

    private String sanitize(String raw) {
        if (raw == null) {
            return "";
        }
        String cleaned = raw.strip()
                .replaceAll("[\\r\\n]+", " ")
                .replace("\"", "")
                .replace("`", "")
                .replaceAll("\\s{2,}", " ")
                .trim();
        return cleaned.length() > 300 ? cleaned.substring(0, 300) : cleaned;
    }

    private String normalizedImageBaseUrl() {
        String trimmed = imageBaseUrl == null ? "" : imageBaseUrl.trim();
        while (trimmed.endsWith("/")) {
            trimmed = trimmed.substring(0, trimmed.length() - 1);
        }
        return trimmed.isEmpty() ? "https://image.pollinations.ai" : trimmed;
    }

    private boolean isSet(String value) {
        return value != null && !value.isBlank();
    }
}
