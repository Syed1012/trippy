package pse.trippy.notificationservice.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;
import pse.trippy.notificationservice.dto.response.NotificationResponse;
import pse.trippy.notificationservice.model.enums.NotificationType;
import pse.trippy.notificationservice.service.NotificationService;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/notifications")
@RequiredArgsConstructor
@Tag(name = "In-App Notifications", description = "Endpoints for managing user notifications, unread counts, and status updates")
public class NotificationController {

    private final NotificationService notificationService;

    @Operation(summary = "Get paginated user notifications", description = "Fetches a paginated list of notifications for the authenticated user, optionally filtered by unread status or type.")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Successfully retrieved notifications page")
    })
    @GetMapping
    public ResponseEntity<Page<NotificationResponse>> getNotifications(
            @Parameter(description = "Authenticated User ID") @RequestHeader("X-User-Id") UUID userId,
            @Parameter(description = "Page index (0-based)") @RequestParam(defaultValue = "0") int page,
            @Parameter(description = "Page size") @RequestParam(defaultValue = "20") int size,
            @Parameter(description = "Filter unread notifications only") @RequestParam(defaultValue = "false") boolean unreadOnly,
            @Parameter(description = "Filter by notification type") @RequestParam(required = false) NotificationType type) {
        return ResponseEntity.ok(notificationService.getNotifications(userId, page, size, unreadOnly, type));
    }

    @Operation(summary = "Get unread notification count", description = "Returns the count of unread notifications for the authenticated user.")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Successfully retrieved unread count")
    })
    @GetMapping("/unread-count")
    public ResponseEntity<Map<String, Long>> getUnreadCount(
            @Parameter(description = "Authenticated User ID") @RequestHeader("X-User-Id") UUID userId) {
        long count = notificationService.getUnreadCount(userId);
        return ResponseEntity.ok(Map.of("count", count, "unreadCount", count));
    }

    @Operation(summary = "Mark notification as read (PATCH)", description = "Marks a specific notification as read by notification ID.")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Notification marked as read"),
            @ApiResponse(responseCode = "404", description = "Notification not found")
    })
    @PatchMapping("/{id}/read")
    public ResponseEntity<Void> markAsRead(
            @Parameter(description = "Notification UUID") @PathVariable UUID id,
            @Parameter(description = "Authenticated User ID") @RequestHeader("X-User-Id") UUID userId) {
        if (!notificationService.markAsRead(id, userId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Notification not found");
        }
        return ResponseEntity.ok().build();
    }

    @Operation(summary = "Mark notification as read (POST)", description = "Alternative POST endpoint to mark a specific notification as read.")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Notification marked as read"),
            @ApiResponse(responseCode = "404", description = "Notification not found")
    })
    @PostMapping("/{id}/read")
    public ResponseEntity<Void> markAsReadPost(
            @Parameter(description = "Notification UUID") @PathVariable UUID id,
            @Parameter(description = "Authenticated User ID") @RequestHeader("X-User-Id") UUID userId) {
        if (!notificationService.markAsRead(id, userId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Notification not found");
        }
        return ResponseEntity.ok().build();
    }

    @Operation(summary = "Mark all notifications as read (PATCH)", description = "Marks all unread notifications for the user as read.")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "All notifications marked as read")
    })
    @PatchMapping("/read-all")
    public ResponseEntity<Void> markAllAsRead(
            @Parameter(description = "Authenticated User ID") @RequestHeader("X-User-Id") UUID userId) {
        notificationService.markAllAsRead(userId);
        return ResponseEntity.ok().build();
    }

    @Operation(summary = "Mark all notifications as read (POST)", description = "Alternative POST endpoint to mark all unread notifications as read.")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "All notifications marked as read")
    })
    @PostMapping("/read-all")
    public ResponseEntity<Void> markAllAsReadPost(
            @Parameter(description = "Authenticated User ID") @RequestHeader("X-User-Id") UUID userId) {
        notificationService.markAllAsRead(userId);
        return ResponseEntity.ok().build();
    }

    @Operation(summary = "Soft delete notification", description = "Soft-deletes a specific notification so it no longer appears in user's list.")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "204", description = "Notification deleted successfully"),
            @ApiResponse(responseCode = "404", description = "Notification not found")
    })
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteNotification(
            @Parameter(description = "Notification UUID") @PathVariable UUID id,
            @Parameter(description = "Authenticated User ID") @RequestHeader("X-User-Id") UUID userId) {
        if (!notificationService.deleteNotification(id, userId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Notification not found");
        }
        return ResponseEntity.noContent().build();
    }
}

