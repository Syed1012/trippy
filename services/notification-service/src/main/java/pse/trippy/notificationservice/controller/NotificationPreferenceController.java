package pse.trippy.notificationservice.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import pse.trippy.notificationservice.dto.request.UpdateNotificationPreferenceRequest;
import pse.trippy.notificationservice.dto.response.NotificationPreferenceResponse;
import pse.trippy.notificationservice.service.NotificationPreferenceService;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/notifications/preferences")
@RequiredArgsConstructor
@Tag(name = "Notification Preferences", description = "Endpoints for managing user notification settings/preferences")
public class NotificationPreferenceController {

    private final NotificationPreferenceService preferenceService;

    @Operation(summary = "Get user notification preferences", description = "Fetches the list of notification preferences for the authenticated user.")
    @GetMapping
    public ResponseEntity<List<NotificationPreferenceResponse>> getPreferences(
            @Parameter(description = "Authenticated User ID") @RequestHeader("X-User-Id") UUID userId) {
        return ResponseEntity.ok(preferenceService.getPreferences(userId));
    }

    @Operation(summary = "Update user notification preferences", description = "Updates the notification preferences for the authenticated user.")
    @PutMapping
    public ResponseEntity<List<NotificationPreferenceResponse>> updatePreferences(
            @Parameter(description = "Authenticated User ID") @RequestHeader("X-User-Id") UUID userId,
            @Valid @RequestBody List<UpdateNotificationPreferenceRequest> requests) {
        return ResponseEntity.ok(preferenceService.updatePreferences(userId, requests));
    }
}
