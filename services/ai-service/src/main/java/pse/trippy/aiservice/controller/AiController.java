package pse.trippy.aiservice.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import pse.trippy.aiservice.dto.request.AiChatRequest;
import pse.trippy.aiservice.dto.request.DestinationSuggestionRequest;
import pse.trippy.aiservice.dto.request.GenerateItineraryRequest;
import pse.trippy.aiservice.dto.request.GroupPreferenceRequest;
import pse.trippy.aiservice.dto.request.TravelAdviceRequest;
import pse.trippy.aiservice.dto.response.AiChatResponse;
import pse.trippy.aiservice.dto.response.ConsolidatedPreferencesResponse;
import pse.trippy.aiservice.dto.response.DestinationSuggestionResponse;
import pse.trippy.aiservice.dto.response.ItineraryResponse;
import pse.trippy.aiservice.dto.response.TravelAdviceResponse;
import pse.trippy.aiservice.service.AiService;

@RestController
@RequestMapping("/ai")
@RequiredArgsConstructor
public class AiController {

    private final AiService aiService;

    /**
     * POST /ai/destination-suggestions
     * Protected via JWT (injected by API Gateway).
     */
    @PostMapping("/destination-suggestions")
    public ResponseEntity<DestinationSuggestionResponse> suggestDestinations(
            @Valid @RequestBody DestinationSuggestionRequest request) {
        return ResponseEntity.ok(aiService.suggestDestinations(request));
    }

    /**
     * POST /ai/travel-advice
     * Protected via JWT (injected by API Gateway).
     */
    @PostMapping("/travel-advice")
    public ResponseEntity<TravelAdviceResponse> getTravelAdvice(
            @Valid @RequestBody TravelAdviceRequest request) {
        return ResponseEntity.ok(aiService.getTravelAdvice(request));
    }

    /**
     * POST /ai/chat
     * Conversational trip assistant. Can update an itinerary when one is supplied.
     */
    @PostMapping("/chat")
    public ResponseEntity<AiChatResponse> chat(
            @Valid @RequestBody AiChatRequest request) {
        return ResponseEntity.ok(aiService.chat(request));
    }

    /**
     * POST /ai/itineraries
     * POST /ai/itinerary/generate
     * Internal S2S endpoint — called by Trip Service.
     */
    @PostMapping({ "/itineraries", "/itinerary/generate" })
    public ResponseEntity<ItineraryResponse> generateItinerary(
            @Valid @RequestBody GenerateItineraryRequest request) {
        return ResponseEntity.ok(aiService.generateItinerary(request));
    }

    /**
     * POST /ai/preferences/consolidate
     * Internal S2S endpoint — called by Trip Service.
     */
    @PostMapping("/preferences/consolidate")
    public ResponseEntity<ConsolidatedPreferencesResponse> consolidatePreferences(
            @Valid @RequestBody GroupPreferenceRequest request) {
        return ResponseEntity.ok(aiService.consolidatePreferences(request));
    }
}
