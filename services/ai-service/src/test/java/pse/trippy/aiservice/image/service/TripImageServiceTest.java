package pse.trippy.aiservice.image.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;
import pse.trippy.aiservice.image.dto.TripImageRequest;
import pse.trippy.aiservice.image.dto.TripImageResponse;

import java.time.Duration;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@DisplayName("TripImageService")
class TripImageServiceTest {

    @Mock
    private ImagePromptClient promptClient;

    private TripImageService service;

    @BeforeEach
    void setUp() {
        service = new TripImageService(promptClient);
        ReflectionTestUtils.setField(service, "enabled", true);
        ReflectionTestUtils.setField(service, "imageBaseUrl", "https://image.pollinations.ai");
        ReflectionTestUtils.setField(service, "imageModel", "flux");
        ReflectionTestUtils.setField(service, "width", 1280);
        ReflectionTestUtils.setField(service, "height", 720);
    }

    private TripImageRequest request(UUID tripId) {
        return new TripImageRequest(tripId, "Paris, France", null);
    }

    @Test
    @DisplayName("an AI-crafted prompt yields a READY image URL with the configured size and model")
    void generate_aiPrompt() {
        when(promptClient.craftScenePrompt(anyString(), anyString(), any(Duration.class)))
                .thenReturn("Eiffel Tower at golden hour, cinematic");

        TripImageResponse response = service.generate(request(UUID.randomUUID()));

        assertThat(response.status()).isEqualTo("READY");
        assertThat(response.source()).isEqualTo("AI");
        assertThat(response.imageUrl()).startsWith("https://image.pollinations.ai/prompt/");
        assertThat(response.imageUrl()).contains("width=1280").contains("height=720").contains("model=flux");
        assertThat(response.prompt()).contains("Eiffel");
    }

    @Test
    @DisplayName("a prompt failure falls back to a destination template but still returns a URL")
    void generate_promptFails_usesFallback() {
        when(promptClient.craftScenePrompt(anyString(), anyString(), any(Duration.class)))
                .thenThrow(new IllegalStateException("ollama down"));

        TripImageResponse response = service.generate(request(UUID.randomUUID()));

        assertThat(response.status()).isEqualTo("READY");
        assertThat(response.source()).isEqualTo("FALLBACK");
        assertThat(response.imageUrl()).startsWith("https://image.pollinations.ai/prompt/");
        assertThat(response.prompt()).contains("Paris");
    }

    @Test
    @DisplayName("when disabled it returns DISABLED and never calls the model")
    void generate_disabled() {
        ReflectionTestUtils.setField(service, "enabled", false);

        TripImageResponse response = service.generate(request(UUID.randomUUID()));

        assertThat(response.status()).isEqualTo("DISABLED");
        assertThat(response.imageUrl()).isNull();
        verify(promptClient, never()).craftScenePrompt(anyString(), anyString(), any(Duration.class));
    }

    @Test
    @DisplayName("the same trip gets a deterministic (stable) image URL")
    void generate_deterministicSeed() {
        when(promptClient.craftScenePrompt(anyString(), anyString(), any(Duration.class)))
                .thenReturn("Eiffel Tower");
        UUID tripId = UUID.randomUUID();

        String first = service.generate(request(tripId)).imageUrl();
        String second = service.generate(request(tripId)).imageUrl();

        assertThat(first).isEqualTo(second);
    }
}
