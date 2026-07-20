package pse.trippy.chatservice.client;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import java.util.List;
import java.util.UUID;

/**
 * REST client for verifying trip participation via trip-service.
 */
@Component
@Slf4j
public class TripServiceClient {

    private final RestTemplate restTemplate;
    private final String tripServiceUrl;

    public TripServiceClient(
            RestTemplate restTemplate,
            @Value("${trippy.trip-service.url}") String tripServiceUrl) {
        this.restTemplate = restTemplate;
        this.tripServiceUrl = tripServiceUrl;
    }

    /**
     * Checks whether a user is a participant of the given trip.
     *
     * @param tripId the trip identifier
     * @param userId the user identifier
     * @return true if the user is a verified participant, false otherwise
     */
    public boolean isParticipant(UUID tripId, UUID userId) {
        try {
            String url = tripServiceUrl + "/trips/" + tripId + "/participants/" + userId;
            log.debug("Verifying participant: GET {}", url);
            ResponseEntity<Void> response = restTemplate.getForEntity(url, Void.class);
            return response.getStatusCode().is2xxSuccessful();
        } catch (Exception e) {
            log.warn("Failed to verify participant tripId={} userId={}",
                    tripId, userId, e);
            return false;
        }
    }

    public List<UUID> getAcceptedParticipantIds(UUID tripId, UUID requesterId) {
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.set("X-User-Id", requesterId.toString());
            ResponseEntity<List<ParticipantSummary>> response = restTemplate.exchange(
                    tripServiceUrl + "/trips/" + tripId + "/participants",
                    HttpMethod.GET,
                    new HttpEntity<>(headers),
                    new ParameterizedTypeReference<>() {});

            List<ParticipantSummary> participants = response.getBody();
            if (participants == null) {
                return List.of();
            }
            return participants.stream()
                    .filter(participant -> "ACCEPTED".equals(participant.status()))
                    .map(ParticipantSummary::userId)
                    .filter(java.util.Objects::nonNull)
                    .toList();
        } catch (Exception exception) {
            log.warn("Failed to load participants tripId={} requesterId={}",
                    tripId, requesterId, exception);
            return List.of();
        }
    }

    private record ParticipantSummary(UUID userId, String status) {}
}
