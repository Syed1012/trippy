package pse.trippy.tripservice.controller;

import java.util.List;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import pse.trippy.tripservice.dto.request.InviteByEmailRequest;
import pse.trippy.tripservice.dto.request.InviteParticipantRequest;
import pse.trippy.tripservice.dto.response.ParticipantActionResponse;
import pse.trippy.tripservice.dto.response.ParticipantResponse;
import pse.trippy.tripservice.service.ParticipantService;

@RestController
@RequestMapping("/trips/{tripId}/participants")
@Slf4j
@RequiredArgsConstructor
public class ParticipantController {

    private final ParticipantService participantService;

    @PostMapping("/invite")
    public ResponseEntity<ParticipantActionResponse> invite(
            @PathVariable UUID tripId,
            @Valid @RequestBody InviteParticipantRequest request,
            @RequestHeader("X-User-Id") UUID userId) {
        log.info("POST /trips/{}/participants/invite — Invite user={}, by={}", tripId, request.userId(), userId);
        ParticipantActionResponse response = participantService.inviteParticipant(tripId, request, userId);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @PostMapping("/invite-by-email")
    public ResponseEntity<ParticipantActionResponse> inviteByEmail(
            @PathVariable UUID tripId,
            @Valid @RequestBody InviteByEmailRequest request,
            @RequestHeader("X-User-Id") UUID userId) {
        log.info("POST /trips/{}/participants/invite-by-email — by={}", tripId, userId);
        ParticipantActionResponse response = participantService.inviteByEmail(tripId, request, userId);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @PostMapping("/approve")
    public ResponseEntity<ParticipantActionResponse> approve(
            @PathVariable UUID tripId,
            @Valid @RequestBody InviteParticipantRequest request,
            @RequestHeader("X-User-Id") UUID userId) {
        log.info("POST /trips/{}/participants/approve — Approve user={}, by={}", tripId, request.userId(), userId);
        ParticipantActionResponse response = participantService.approveInvite(tripId, request.userId(), userId);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/reject")
    public ResponseEntity<ParticipantActionResponse> reject(
            @PathVariable UUID tripId,
            @Valid @RequestBody InviteParticipantRequest request,
            @RequestHeader("X-User-Id") UUID userId) {
        log.info("POST /trips/{}/participants/reject — Reject user={}, by={}", tripId, request.userId(), userId);
        ParticipantActionResponse response = participantService.rejectInvite(tripId, request.userId(), userId);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/accept")
    public ResponseEntity<ParticipantActionResponse> accept(
            @PathVariable UUID tripId,
            @RequestHeader("X-User-Id") UUID userId) {
        log.info("POST /trips/{}/participants/accept — user={}", tripId, userId);
        ParticipantActionResponse response = participantService.acceptInvite(tripId, userId);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/decline")
    public ResponseEntity<ParticipantActionResponse> decline(
            @PathVariable UUID tripId,
            @RequestHeader("X-User-Id") UUID userId) {
        log.info("POST /trips/{}/participants/decline — user={}", tripId, userId);
        ParticipantActionResponse response = participantService.declineInvite(tripId, userId);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/request-join")
    public ResponseEntity<ParticipantActionResponse> requestJoin(
            @PathVariable UUID tripId,
            @RequestHeader("X-User-Id") UUID userId,
            @RequestBody(required = false) java.util.Map<String, String> body) {
        log.info("POST /trips/{}/participants/request-join — user={}", tripId, userId);
        String requesterName = body != null ? body.get("requesterName") : null;
        String message = body != null ? body.get("message") : null;
        ParticipantActionResponse response = participantService.requestJoin(tripId, userId, requesterName, message);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @DeleteMapping("/leave")
    public ResponseEntity<Void> leave(
            @PathVariable UUID tripId,
            @RequestHeader("X-User-Id") UUID userId) {
        log.info("DELETE /trips/{}/participants/leave — user={}", tripId, userId);
        participantService.leaveTrip(tripId, userId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping
    public ResponseEntity<List<ParticipantResponse>> list(
            @PathVariable UUID tripId,
            @RequestHeader("X-User-Id") UUID userId) {
        log.info("GET /trips/{}/participants — user={}", tripId, userId);
        List<ParticipantResponse> response = participantService.listParticipants(tripId, userId);
        return ResponseEntity.ok(response);
    }

    @DeleteMapping("/kick/{targetUserId}")
    public ResponseEntity<ParticipantActionResponse> kick(
            @PathVariable UUID tripId,
            @PathVariable UUID targetUserId,
            @RequestHeader("X-User-Id") UUID userId) {
        log.info("DELETE /trips/{}/participants/kick/{} — by={}", tripId, targetUserId, userId);
        ParticipantActionResponse response = participantService.kickParticipant(tripId, targetUserId, userId);
        return ResponseEntity.ok(response);
    }
}
