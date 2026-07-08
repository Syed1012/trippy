package pse.trippy.tripservice.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import pse.trippy.tripservice.dto.request.CreateTripRequest;
import pse.trippy.tripservice.dto.request.UpdateTripRequest;
import pse.trippy.tripservice.dto.request.UpdateTripStatusRequest;
import pse.trippy.tripservice.dto.response.TripDetailResponse;
import pse.trippy.tripservice.dto.response.TripPageResponse;
import pse.trippy.tripservice.dto.response.TripResponse;
import pse.trippy.tripservice.service.TripService;

import java.util.UUID;

@RestController
@RequestMapping("/trips")
@Slf4j
@RequiredArgsConstructor
public class TripController {

    private final TripService tripService;

    @PostMapping
    public ResponseEntity<TripResponse> createTrip(
            @Valid @RequestBody CreateTripRequest request,
            @RequestHeader("X-User-Id") UUID userId) {
        log.info("POST /trips — Creating trip '{}' to '{}' | visibility={} | user={}",
                request.title(), request.destination(),
                request.visibility() != null ? request.visibility() : "PRIVATE", userId);
        TripResponse response = tripService.createTrip(request, userId);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping
    public ResponseEntity<TripPageResponse> listMyTrips(
            @RequestHeader("X-User-Id") UUID userId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        log.debug("GET /trips — user={}, page={}, size={}", userId, page, size);
        TripPageResponse response = tripService.listMyTrips(userId, page, size);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/public")
    public ResponseEntity<TripPageResponse> listPublicTrips(
            @RequestHeader("X-User-Id") UUID userId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        log.debug("GET /trips/public — user={}, page={}, size={}", userId, page, size);
        TripPageResponse response = tripService.listPublicTrips(userId, page, size);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/{tripId}")
    public ResponseEntity<TripDetailResponse> getTripDetail(
            @PathVariable UUID tripId,
            @RequestHeader("X-User-Id") UUID userId) {
        log.debug("GET /trips/{} — user={}", tripId, userId);
        TripDetailResponse response = tripService.getTripDetail(tripId, userId);
        return ResponseEntity.ok(response);
    }

    @PatchMapping("/{tripId}")
    public ResponseEntity<TripResponse> updateTrip(
            @PathVariable UUID tripId,
            @Valid @RequestBody UpdateTripRequest request,
            @RequestHeader("X-User-Id") UUID userId) {
        log.info("PATCH /trips/{} — Update trip, user={}", tripId, userId);
        TripResponse response = tripService.updateTrip(tripId, request, userId);
        return ResponseEntity.ok(response);
    }

    /**
     * Trip status lifecycle transition (owner-only).
     * e.g. DRAFT → PLANNED → ONGOING → COMPLETED, or CANCELLED.
     */
    @PatchMapping("/{tripId}/status")
    public ResponseEntity<TripResponse> updateTripStatus(
            @PathVariable UUID tripId,
            @Valid @RequestBody UpdateTripStatusRequest request,
            @RequestHeader("X-User-Id") UUID userId) {
        log.info("PATCH /trips/{}/status — status={}, user={}", tripId, request.status(), userId);
        TripResponse response = tripService.updateTripStatus(tripId, request.status(), userId);
        return ResponseEntity.ok(response);
    }

    @DeleteMapping("/{tripId}")
    public ResponseEntity<Void> deleteTrip(
            @PathVariable UUID tripId,
            @RequestHeader("X-User-Id") UUID userId) {
        log.info("DELETE /trips/{} — Delete trip, user={}", tripId, userId);
        tripService.deleteTrip(tripId, userId);
        return ResponseEntity.noContent().build();
    }
}
