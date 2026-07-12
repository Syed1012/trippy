package pse.trippy.tripservice.controller;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import pse.trippy.tripservice.dto.response.ItineraryResponse;
import pse.trippy.tripservice.service.ItineraryService;

import java.util.UUID;

@RestController
@RequestMapping("/trips/shared/{tripId}")
@RequiredArgsConstructor
@Slf4j
public class SharedTripController {

    private final ItineraryService itineraryService;

    @GetMapping("/itinerary")
    public ResponseEntity<ItineraryResponse> getSharedItinerary(@PathVariable UUID tripId) {
        log.debug("GET /trips/shared/{}/itinerary", tripId);
        ItineraryResponse response = itineraryService.getSharedItinerary(tripId);
        return ResponseEntity.ok(response);
    }
}
