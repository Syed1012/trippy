package pse.trippy.aiservice.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import pse.trippy.aiservice.dto.request.AiChatRequest;
import pse.trippy.aiservice.dto.request.DestinationSuggestionRequest;
import pse.trippy.aiservice.dto.request.GenerateItineraryRequest;
import pse.trippy.aiservice.dto.request.GroupPreferenceRequest;
import pse.trippy.aiservice.dto.request.TravelAdviceRequest;
import pse.trippy.aiservice.dto.response.AiChatResponse;
import pse.trippy.aiservice.dto.response.AiUsageResponse;
import pse.trippy.aiservice.dto.response.ConsolidatedPreferencesResponse;
import pse.trippy.aiservice.dto.response.DestinationSuggestionResponse;
import pse.trippy.aiservice.dto.response.ItineraryResponse;
import pse.trippy.aiservice.dto.response.TravelAdviceResponse;
import pse.trippy.aiservice.service.AiService;
import pse.trippy.aiservice.service.AiUsageService;

import java.util.UUID;

@RestController
@RequestMapping("/ai")
@RequiredArgsConstructor
@Tag(name = "AI Service", description = "Endpoints for AI itinerary generation, trip chat assistant, travel advice, and usage analytics")
public class AiController {

    private final AiService aiService;
    private final AiUsageService aiUsageService;

    /**
     * POST /ai/destination-suggestions
     * Protected via JWT (injected by API Gateway).
     */
    @Operation(summary = "Suggest trip destinations", description = "Generates AI-curated destination recommendations based on user budget, style, and travel constraints.")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Successfully generated destination suggestions"),
            @ApiResponse(responseCode = "400", description = "Invalid request payload or missing required criteria")
    })
    @PostMapping("/destination-suggestions")
    public ResponseEntity<DestinationSuggestionResponse> suggestDestinations(
            @Valid @RequestBody DestinationSuggestionRequest request) {
        return ResponseEntity.ok(aiService.suggestDestinations(request));
    }

    /**
     * POST /ai/travel-advice
     * Protected via JWT (injected by API Gateway).
     */
    @Operation(summary = "Get travel advice & tips", description = "Provides AI travel advice covering culture, safety, packing, and best times to visit.")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Successfully returned travel advice"),
            @ApiResponse(responseCode = "400", description = "Invalid request payload")
    })
    @PostMapping("/travel-advice")
    public ResponseEntity<TravelAdviceResponse> getTravelAdvice(
            @Valid @RequestBody TravelAdviceRequest request) {
        return ResponseEntity.ok(aiService.getTravelAdvice(request));
    }

    /**
     * POST /ai/chat
     * Conversational trip assistant. Can update an itinerary when one is supplied.
     */
    @Operation(summary = "Conversational trip assistant chat", description = "Interactive chat endpoint for trip modification, local tips, and real-time planning.")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Chat message successfully processed"),
            @ApiResponse(responseCode = "400", description = "Invalid chat input")
    })
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
    @Operation(summary = "Generate full trip itinerary", description = "S2S endpoint for complete day-by-day itinerary generation with activity scheduling, weather, and route integration.")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Itinerary generated successfully"),
            @ApiResponse(responseCode = "500", description = "AI generation failure or provider fallback exhausted")
    })
    @PostMapping({ "/itineraries", "/itinerary/generate" })
    public ResponseEntity<ItineraryResponse> generateItinerary(
            @Valid @RequestBody GenerateItineraryRequest request) {
        return ResponseEntity.ok(aiService.generateItinerary(request));
    }

    /**
     * POST /ai/itineraries/{generationId}/retry
     * Retries a failed or fallback itinerary generation. Max 3 retries.
     */
    @Operation(summary = "Retry failed itinerary generation", description = "Retries generation for an existing generation ID (maximum 3 retry attempts).")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Retried itinerary generated successfully"),
            @ApiResponse(responseCode = "400", description = "Retry limit exceeded or invalid generation ID")
    })
    @PostMapping("/itineraries/{generationId}/retry")
    public ResponseEntity<ItineraryResponse> retryItinerary(
            @Parameter(description = "UUID of the generation attempt to retry") @PathVariable java.util.UUID generationId) {
        return ResponseEntity.ok(aiService.retryItinerary(generationId));
    }

    /**
     * POST /ai/preferences/consolidate
     * Internal S2S endpoint — called by Trip Service.
     */
    @Operation(summary = "Consolidate group trip preferences", description = "Consolidates diverse group member preferences into unified trip generation parameters.")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Group preferences consolidated successfully"),
            @ApiResponse(responseCode = "400", description = "Invalid preference payload")
    })
    @PostMapping("/preferences/consolidate")
    public ResponseEntity<ConsolidatedPreferencesResponse> consolidatePreferences(
            @Valid @RequestBody GroupPreferenceRequest request) {
        return ResponseEntity.ok(aiService.consolidatePreferences(request));
    }

    /**
     * GET /ai/usage
     * GET /ai/usage/{userId}
     * Retrieves AI usage analytics for a specific user (or from header/query param).
     */
    @Operation(summary = "Get AI usage metrics", description = "Retrieves total AI tokens consumed, generation count, and usage quotas for a given user.")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Usage metrics retrieved successfully"),
            @ApiResponse(responseCode = "400", description = "Missing authenticated user context"),
            @ApiResponse(responseCode = "403", description = "Usage requested for a different user")
    })
    @GetMapping({ "/usage", "/usage/{userId}" })
    public ResponseEntity<AiUsageResponse> getUsage(
            @Parameter(description = "Target User UUID (optional path variable)") @PathVariable(required = false) UUID userId,
            @Parameter(description = "Authenticated User UUID from Gateway header") @RequestHeader("X-User-Id") UUID headerUserId,
            @Parameter(description = "Target User UUID (optional query parameter)") @RequestParam(value = "userId", required = false) UUID paramUserId) {
        UUID requestedUserId = userId != null ? userId : paramUserId;
        if (requestedUserId != null && !requestedUserId.equals(headerUserId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Usage is only available for the authenticated user");
        }
        return ResponseEntity.ok(aiUsageService.getUsage(headerUserId));
    }
}
