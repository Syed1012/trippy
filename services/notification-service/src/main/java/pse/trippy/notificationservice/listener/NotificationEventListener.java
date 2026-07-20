package pse.trippy.notificationservice.listener;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

import org.slf4j.MDC;
import org.springframework.amqp.core.Message;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.messaging.handler.annotation.Header;
import org.springframework.stereotype.Component;

import com.fasterxml.jackson.databind.ObjectMapper;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import pse.trippy.notificationservice.dto.response.NotificationResponse;
import pse.trippy.notificationservice.logging.CorrelationIds;
import pse.trippy.notificationservice.logging.LogSanitizer;
import pse.trippy.notificationservice.model.entity.Notification;
import pse.trippy.notificationservice.model.enums.NotificationChannel;
import pse.trippy.notificationservice.model.enums.NotificationType;
import pse.trippy.notificationservice.service.EmailService;
import pse.trippy.notificationservice.service.NotificationPreferenceService;
import pse.trippy.notificationservice.service.NotificationService;
import pse.trippy.notificationservice.service.SseNotificationService;

@Component
@RequiredArgsConstructor
@Slf4j
public class NotificationEventListener {

    private static final String DASHBOARD_PATH = "/dashboard";

    @Value("${app.base-url:https://trippy.app}")
    private String appBaseUrl = "https://trippy.app";

    private String getNormalizedBaseUrl() {
        String effectiveBaseUrl = (appBaseUrl == null || appBaseUrl.isBlank()) ? "https://trippy.app" : appBaseUrl.trim();
        if (effectiveBaseUrl.endsWith("/")) {
            effectiveBaseUrl = effectiveBaseUrl.substring(0, effectiveBaseUrl.length() - 1);
        }
        return effectiveBaseUrl;
    }

    private String dashboardUrl() {
        return getNormalizedBaseUrl() + DASHBOARD_PATH;
    }

    private final EmailService emailService;
    private final NotificationService notificationService;
    private final ObjectMapper objectMapper;
    private final pse.trippy.notificationservice.service.WebPushService webPushService;
    private final SseNotificationService sseNotificationService;
    private final NotificationPreferenceService notificationPreferenceService;

    @RabbitListener(queues = "notification.events")
    public void handleEvent(Message rawMessage,
                            @Header(name = "amqp_receivedRoutingKey") String routingKey,
                            @Header(name = CorrelationIds.HEADER_NAME, required = false) String correlationId) {
        String resolvedCorrelationId = CorrelationIds.resolve(correlationId);
        MDC.put(CorrelationIds.MDC_KEY, resolvedCorrelationId);
        try {
            log.info("Received notification event routingKey={}", LogSanitizer.safeDetail(routingKey));
            Object payload = deserializePayload(rawMessage);
            try {
                dispatchEvent(payload, routingKey);
            } catch (Exception ex) {
                log.error("Failed to process event routingKey={} error={}", 
                        LogSanitizer.safeDetail(routingKey), LogSanitizer.safeError(ex));
                throw ex;
            }
        } finally {
            MDC.remove(CorrelationIds.MDC_KEY);
        }
    }

    @SuppressWarnings("unchecked")
    private Object deserializePayload(Message message) {
        try {
            return objectMapper.readValue(message.getBody(), Map.class);
        } catch (Exception ex) {
            log.warn("Failed to deserialize RabbitMQ message body as Map, falling back to raw: {}",
                    ex.getMessage());
            return message;
        }
    }

    void handleEvent(Object payload, String routingKey) {
        handleEvent(payload, routingKey, null);
    }

    void handleEvent(Object payload, String routingKey, String correlationId) {
        String resolvedCorrelationId = CorrelationIds.resolve(correlationId);
        MDC.put(CorrelationIds.MDC_KEY, resolvedCorrelationId);
        try {
            dispatchEvent(payload, routingKey);
        } finally {
            MDC.remove(CorrelationIds.MDC_KEY);
        }
    }

    private void dispatchEvent(Object payload, String routingKey) {
        switch (routingKey) {
            case "user.registered" -> handleUserRegistered(payload);
            case "user.email.verified" -> handleUserEmailVerified(payload);
            case "user.password.reset" -> handlePasswordReset(payload);
            case "trip.invitation.created", "trip.participant.invited" -> handleTripInvitation(payload);
            case "trip.invitation.accepted", "trip.joined", "trip.participant.joined" -> handleTripJoined(payload);
            case "trip.participant.declined" -> handleInvitationDeclined(payload);
            case "trip.participant.join_requested", "trip.participant.invite_proposed" -> handleJoinRequest(payload);
            case "trip.participant.approved" -> handleJoinApproved(payload);
            case "trip.participant.rejected" -> handleJoinRejected(payload);
            case "trip.updated" -> handleTripUpdated(payload);
            case "chat.message.sent" -> handleChatMessageSent(payload);
            case "payment.completed" -> handlePaymentCompleted(payload);
            case "payment.failed" -> handlePaymentFailed(payload);
            case "ai.itinerary.ready", "ai.itinerary.generated", "itinerary.ready" -> handleItineraryGenerated(payload);
            case "system.notification" -> handleSystemNotification(payload);
            default -> log.warn("Unknown notification event routingKey={}", LogSanitizer.safeDetail(routingKey));
        }
    }

    void handleUserRegistered(Object payload) {
        if (payload instanceof Map<?, ?> map) {
            String email = text(map, "email");
            String displayName = text(map, "displayName", "userName", "name");
            String userId = text(map, "userId");
            String verificationToken = text(map, "verificationToken", "verificationCode", "token");

            if (verificationToken == null || verificationToken.isBlank()) {
                log.warn("Skipping notification event type=user.registered due to missing verification token recipient={} userId={}",
                        LogSanitizer.maskEmail(email),
                        LogSanitizer.safeDetail(userId));
                return;
            }

            log.info("Processing notification event type=user.registered recipient={}",
                    LogSanitizer.maskEmail(email));
            sendTemplate(email, "Verify your Trippy account", "email-verification",
                    variables("userName", fallback(displayName, "Traveler"),
                            "verificationCode", verificationToken));

            createNotification(userId, NotificationType.EMAIL_VERIFICATION,
                    "Verify your email",
                    "Use the verification code we emailed to activate your Trippy account.",
                    "/verify-email",
                    metadata(map, "userId"));
        }
    }

    void handleUserEmailVerified(Object payload) {
        if (payload instanceof Map<?, ?> map) {
            String email = text(map, "email");
            String displayName = text(map, "displayName", "userName", "name");
            String userId = text(map, "userId");
            String resolvedDisplayName = fallback(displayName, "Traveler");

            log.info("Processing notification event type=user.email.verified recipient={}",
                    LogSanitizer.maskEmail(email));
            sendTemplate(email, "Welcome to Trippy!", "welcome",
                    variables("userName", resolvedDisplayName,
                            "dashboardUrl", dashboardUrl()));

            createNotification(userId, NotificationType.WELCOME,
                    "Welcome to Trippy!",
                    "Your email is verified and your account is ready.",
                    "/dashboard",
                    metadata(map, "userId"));
        }
    }

    void handlePasswordReset(Object payload) {
        if (payload instanceof Map<?, ?> map) {
            String email = text(map, "email");
            String userName = fallback(text(map, "userName", "displayName", "name"), "Traveler");
            String userId = validUuidText(map, "userId", "recipientUserId");
            String resetLink = fallback(text(map, "resetLink", "passwordResetUrl", "link"), dashboardUrl());

            log.info("Processing notification event type=user.password.reset recipient={}",
                    LogSanitizer.maskEmail(email));
            sendTemplate(email, "Reset your Trippy password", "password-reset",
                    variables("userName", userName,
                            "resetLink", resetLink));

            createNotification(userId, NotificationType.PASSWORD_RESET,
                    "Password Reset Requested",
                    "Use the password reset link we sent to update your Trippy password.",
                    "/login",
                    null);
        }
    }

    void handleTripInvitation(Object payload) {
        if (payload instanceof Map<?, ?> map) {
            try {
                String inviteeEmail = text(map, "inviteeEmail", "participantEmail", "email");
                String inviteeName = fallback(
                        text(map, "inviteeName", "participantName", "userName", "displayName"),
                        "Traveler");
                String inviterName = fallback(text(map, "inviterName", "actorName"), "Someone");
                String tripTitle = fallback(text(map, "tripTitle", "tripName", "title"), "a trip");
                String destination = text(map, "destination");
                String startDate = text(map, "startDate");
                String endDate = text(map, "endDate");
                String tripDescription = text(map, "tripDescription", "description");
                String inviteeId = validUuidText(map, "inviteeId", "inviteeUserId", "participantId", "userId");
                String tripId = text(map, "tripId");
                String inviteMessage = text(map, "inviteMessage", "message");
                String actionUrl = fallback(text(map, "actionUrl", "inviteLink", "link"), tripUrl(tripId));

                String dateRange = formatDateRange(startDate, endDate);
                String tripSummary = fallback(destination, "") +
                        (destination != null && !destination.isBlank() && !dateRange.isBlank() ? " • " : "") +
                        dateRange;

                String subject = destination != null && !destination.isBlank()
                        ? inviterName + " invited you on the " + tripTitle + " trip to " + destination + "!"
                        : inviterName + " invited you to " + tripTitle + "!";

                String body = inviterName + " invited you to " + tripTitle;
                if (!tripSummary.isBlank()) {
                    body = body + " (" + tripSummary + ")";
                }
                if (inviteMessage != null && !inviteMessage.isBlank()) {
                    body = body + ": \"" + inviteMessage + "\"";
                }

                log.info("Processing trip invitation: inviteeId={} tripId={} tripTitle={} inviterName={}",
                        inviteeId, tripId, tripTitle, inviterName);

                boolean emailEnabled = notificationPreferenceService.isChannelEnabled(uuid(inviteeId), NotificationType.TRIP_INVITE, NotificationChannel.EMAIL);
                if (emailEnabled) {
                    sendTemplate(inviteeEmail, subject,
                            "trip-invite",
                            variables("inviteeName", inviteeName,
                                    "userName", inviteeName,
                                    "inviterName", inviterName,
                                    "tripTitle", tripTitle,
                                    "tripName", tripTitle,
                                    "destination", fallback(destination, ""),
                                    "dateRange", dateRange,
                                    "tripSummary", tripSummary,
                                    "tripDescription", fallback(tripDescription, ""),
                                    "inviteMessage", fallback(inviteMessage, ""),
                                    "dashboardUrl", emailUrl(actionUrl),
                                    "link", emailUrl(actionUrl)));
                }

                createNotification(inviteeId, NotificationType.TRIP_INVITE,
                        "Trip Invitation",
                        body,
                        actionUrl,
                        metadata(map, "tripId", "tripTitle", "destination", "role",
                                "inviterId", "inviteeId", "inviteeUserId", "participantId", "inviteMessage"));
            } catch (Exception ex) {
                log.error("Failed to process trip invitation event", ex);
            }
        } else {
            log.warn("handleTripInvitation received non-Map payload: {}",
                    payload != null ? payload.getClass().getName() : "null");
        }
    }

    void handleInvitationAccepted(Object payload) {
        handleTripJoined(payload);
    }

    void handleInvitationDeclined(Object payload) {
        if (payload instanceof Map<?, ?> map) {
            UUID inviteeId = uuid(text(map, "inviteeId", "participantId"));
            if (inviteeId != null) {
                notificationService.resolveTripInvitation(inviteeId, text(map, "tripId"), "Declined");
            }
        }
    }

    void handleTripJoined(Object payload) {
        if (payload instanceof Map<?, ?> map) {
            String email = text(map, "inviterEmail", "email", "ownerEmail");
            String userName = fallback(text(map, "inviterName", "userName", "displayName"), "Traveler");
            String joinerName = fallback(text(map, "inviteeName", "participantName", "joinedBy"), "A traveler");
            String tripTitle = fallback(text(map, "tripTitle", "tripName", "title"), "your trip");
            String userId = text(map, "inviterId", "ownerId", "userId");
            String tripId = text(map, "tripId");
            String actionUrl = fallback(text(map, "actionUrl", "link"), tripUrl(tripId));

            UUID inviteeId = uuid(text(map, "inviteeId", "participantId"));
            if (inviteeId != null) {
                notificationService.resolveTripInvitation(inviteeId, tripId, "Accepted");
            }

            log.info("Processing notification event type=trip.joined recipient={}",
                    LogSanitizer.maskEmail(email));
            boolean emailEnabled = notificationPreferenceService.isChannelEnabled(uuid(userId), NotificationType.TRIP_JOINED, NotificationChannel.EMAIL);
            if (emailEnabled) {
                sendTemplate(email, joinerName + " joined " + tripTitle,
                        "trip-joined",
                        variables("userName", userName,
                                "inviterName", userName,
                                "inviteeName", joinerName,
                                "joinerName", joinerName,
                                "participantName", joinerName,
                                "tripTitle", tripTitle,
                                "tripName", tripTitle,
                                "dashboardUrl", emailUrl(actionUrl),
                                "link", emailUrl(actionUrl)));
            }

            createNotification(userId, NotificationType.TRIP_JOINED,
                    "Trip Joined",
                    joinerName + " joined " + tripTitle,
                    actionUrl,
                    metadata(map, "tripId", "inviteeId", "participantId"));
        }
    }

    void handleJoinRequest(Object payload) {
        if (payload instanceof Map<?, ?> map) {
            String userId = validUuidText(map, "userId", "ownerId");
            String requesterName = fallback(text(map, "requesterName"), "Someone");
            String tripTitle = fallback(text(map, "tripTitle", "tripName", "title"), "a trip");
            String tripId = text(map, "tripId");
            String joinMessage = text(map, "joinMessage", "message");
            String actionUrl = tripUrl(tripId);

            log.info("Processing notification event type=trip.join_requested tripId={} requester={}",
                    tripId, requesterName);

            String body = requesterName + " wants to join " + tripTitle + ". Review and approve or reject the request.";
            if (joinMessage != null && !joinMessage.isBlank()) {
                body = requesterName + " wants to join " + tripTitle + ": \"" + joinMessage + "\"";
            }

            createNotification(userId, NotificationType.TRIP_INVITE,
                    "Join Request",
                    body,
                    actionUrl,
                    metadata(map, "tripId", "requesterId", "tripTitle", "requesterName", "joinMessage"));
        }
    }

    void handleJoinApproved(Object payload) {
        if (payload instanceof Map<?, ?> map) {
            String userId = validUuidText(map, "userId");
            String tripTitle = fallback(text(map, "tripTitle", "tripName", "title"), "a trip");
            String tripId = text(map, "tripId");
            String actionUrl = tripUrl(tripId);

            UUID ownerId = uuid(text(map, "ownerId"));
            notificationService.resolveJoinRequest(ownerId, tripId, text(map, "requesterId", "userId"), "Approved");

            log.info("Processing notification event type=trip.participant.approved tripId={}", tripId);

            createNotification(userId, NotificationType.TRIP_JOINED,
                    "Join Request Approved",
                    "You are now a participant of " + tripTitle + "! Start exploring the trip.",
                    actionUrl,
                    metadata(map, "tripId", "tripTitle"));
        }
    }

    void handleJoinRejected(Object payload) {
        if (payload instanceof Map<?, ?> map) {
            UUID ownerId = uuid(text(map, "ownerId"));
            notificationService.resolveJoinRequest(
                    ownerId, text(map, "tripId"), text(map, "requesterId"), "Rejected");
        }
    }

    void handleTripUpdated(Object payload) {
        if (payload instanceof Map<?, ?> map) {
            String email = text(map, "email");
            String userName = fallback(text(map, "userName", "displayName"), "Traveler");
            String userId = text(map, "userId");
            String tripTitle = fallback(text(map, "tripTitle", "tripName", "title"), "your trip");
            String updatedBy = fallback(text(map, "updatedBy", "actorName"), "");
            String tripId = text(map, "tripId");
            String actionUrl = fallback(text(map, "actionUrl", "link"), tripUrl(tripId));

            log.info("Processing notification event type=trip.updated recipient={}",
                    LogSanitizer.maskEmail(email));
            boolean emailEnabled = notificationPreferenceService.isChannelEnabled(uuid(userId), NotificationType.TRIP_UPDATED, NotificationChannel.EMAIL);
            if (emailEnabled) {
                sendTemplate(email, "Trip updated: " + tripTitle,
                        "trip-updated",
                        variables("userName", userName,
                                "tripTitle", tripTitle,
                                "updatedBy", updatedBy,
                                "dashboardUrl", emailUrl(actionUrl)));
            }

            createNotification(userId, NotificationType.TRIP_UPDATED,
                    "Trip Updated",
                    "The trip " + tripTitle + " has been updated",
                    actionUrl,
                    metadata(map, "tripId", "updatedBy"));
        }
    }

    void handleChatMessageSent(Object payload) {
        if (payload instanceof Map<?, ?> map) {
            String recipientUserId = validUuidText(map, "recipientUserId");
            String tripId = validUuidText(map, "tripId");
            if (recipientUserId == null || tripId == null) {
                log.warn("Skipping chat.message.sent due to invalid recipient or trip ID");
                return;
            }

            String senderName = fallback(text(map, "senderDisplayName"), "A trip participant");
            createNotification(recipientUserId, NotificationType.NEW_MESSAGE,
                    "New group message",
                    senderName + " sent a message in your trip chat",
                    "/dashboard/chat/" + tripId,
                    metadata(map, "tripId", "messageId", "senderId", "senderDisplayName"));
        }
    }

    void handlePaymentCompleted(Object payload) {
        if (payload instanceof Map<?, ?> map) {
            String email = text(map, "email");
            String userName = fallback(text(map, "userName", "displayName"), "Traveler");
            String userId = text(map, "userId");
            String amount = fallback(text(map, "amount"), "0.00");
            String planName = fallback(text(map, "planName", "plan"), "Trippy plan");
            String actionUrl = fallback(text(map, "actionUrl", "link"), "/dashboard/payments");

            log.info("Processing notification event type=payment.completed recipient={}",
                    LogSanitizer.maskEmail(email));
            boolean emailEnabled = notificationPreferenceService.isChannelEnabled(uuid(userId), NotificationType.PAYMENT_SUCCESS, NotificationChannel.EMAIL);
            if (emailEnabled) {
                sendTemplate(email, "Payment successful - " + amount + " EUR for " + planName,
                        "payment-success",
                        variables("userName", userName,
                                "amount", amount,
                                "planName", planName,
                                "dashboardUrl", emailUrl(actionUrl),
                                "link", emailUrl(actionUrl)));
            }

            createNotification(userId, NotificationType.PAYMENT_SUCCESS,
                    "Payment Successful",
                    "Your payment of " + amount + " EUR for " + planName + " was successful",
                    actionUrl,
                    metadata(map, "paymentId", "transactionId", "planName", "amount"));
        }
    }

    void handlePaymentFailed(Object payload) {
        if (payload instanceof Map<?, ?> map) {
            String email = text(map, "email");
            String userName = fallback(text(map, "userName", "displayName"), "Traveler");
            String userId = text(map, "userId");
            String actionUrl = fallback(text(map, "actionUrl", "link"), "/dashboard/payments");

            log.info("Processing notification event type=payment.failed recipient={}",
                    LogSanitizer.maskEmail(email));
            boolean emailEnabled = notificationPreferenceService.isChannelEnabled(uuid(userId), NotificationType.PAYMENT_FAILED, NotificationChannel.EMAIL);
            if (emailEnabled) {
                sendTemplate(email, "Payment could not be processed",
                        "payment-failed",
                        variables("userName", userName,
                                "dashboardUrl", emailUrl(actionUrl),
                                "link", emailUrl(actionUrl)));
            }

            createNotification(userId, NotificationType.PAYMENT_FAILED,
                    "Payment Failed",
                    "Your payment could not be processed. Please check your payment details.",
                    actionUrl,
                    metadata(map, "paymentId", "transactionId"));
        }
    }

    void handleItineraryGenerated(Object payload) {
        if (payload instanceof Map<?, ?> map) {
            String email = text(map, "email");
            String userName = fallback(text(map, "userName", "displayName"), "Traveler");
            String userId = text(map, "userId");
            String tripTitle = fallback(text(map, "tripTitle", "tripName", "title"), "your trip");
            String tripId = text(map, "tripId");
            String generationId = text(map, "generationId");
            String destination = fallback(text(map, "destination"), tripTitle);
            String actionUrl = fallback(text(map, "actionUrl", "link"), tripUrl(tripId));

            log.info("Processing notification event type=ai.itinerary.generated recipient={}",
                    LogSanitizer.maskEmail(email));
            boolean emailEnabled = notificationPreferenceService.isChannelEnabled(uuid(userId), NotificationType.ITINERARY_READY, NotificationChannel.EMAIL);
            if (emailEnabled) {
                sendTemplate(email, "Your Trippy itinerary is ready",
                        "itinerary-ready",
                        variables("userName", userName,
                                "tripTitle", tripTitle,
                                "tripName", tripTitle,
                                "generationId", generationId,
                                "destination", destination,
                                "tripUrl", emailUrl(actionUrl),
                                "dashboardUrl", emailUrl(actionUrl),
                                "link", emailUrl(actionUrl)));
            }

            createNotification(userId, NotificationType.ITINERARY_READY,
                    "Itinerary Ready",
                    "Your itinerary for " + tripTitle + " is ready to review.",
                    actionUrl,
                    metadata(map, "tripId", "generationId"));
        }
    }

    void handleSystemNotification(Object payload) {
        if (payload instanceof Map<?, ?> map) {
            String email = text(map, "email");
            String userName = fallback(text(map, "userName", "displayName"), "Traveler");
            String userId = text(map, "userId", "recipientUserId");
            String title = fallback(text(map, "title"), "Trippy update");
            String message = fallback(text(map, "message"), "You have a new Trippy notification.");
            String actionUrl = fallback(text(map, "actionUrl", "link"), "/dashboard");

            log.info("Processing notification event type=system.notification recipient={}",
                    LogSanitizer.maskEmail(email));
            boolean emailEnabled = notificationPreferenceService.isChannelEnabled(uuid(userId), NotificationType.SYSTEM, NotificationChannel.EMAIL);
            if (emailEnabled) {
                sendTemplate(email, title, "system-notification",
                        variables("userName", userName,
                                "title", title,
                                "message", message,
                                "actionUrl", emailUrl(actionUrl),
                                "link", emailUrl(actionUrl)));
            }

            createNotification(userId, NotificationType.SYSTEM,
                    title,
                    message,
                    actionUrl,
                    metadata(map, "category", "severity"));
        }
    }

    private void sendTemplate(String email, String subject, String templateName,
                              Map<String, Object> variables) {
        if (email == null || email.isBlank()) {
            log.warn("Skipping {} email because recipient is missing", templateName);
            return;
        }
        emailService.sendTemplateEmail(email, subject, templateName, variables);
    }

    private void createNotification(String userId, NotificationType type, String title,
                                    String message, String actionUrl,
                                    Map<String, Object> metadata) {
        UUID parsedUserId = uuid(userId);
        if (parsedUserId == null) {
            return;
        }
        boolean inAppEnabled = notificationPreferenceService.isChannelEnabled(parsedUserId, type, NotificationChannel.IN_APP);
        boolean pushEnabled = notificationPreferenceService.isChannelEnabled(parsedUserId, type, NotificationChannel.PUSH);

        if (inAppEnabled) {
            String resolvedActionUrl = inAppActionUrl(actionUrl);
            Notification saved = notificationService.createNotification(parsedUserId, type, title, message,
                    resolvedActionUrl, metadata);

            // Send via SSE for real-time delivery
            try {
                NotificationResponse response = new NotificationResponse(
                        saved.getId(),
                        saved.getId(),
                        saved.getUserId(),
                        saved.getType(),
                        saved.getTitle(),
                        saved.getMessage(),
                        saved.getMessage(),
                        saved.getActionUrl(),
                        saved.getMetadata(),
                        saved.isRead(),
                        saved.getCreatedAt(),
                        saved.getReadAt()
                );
                sseNotificationService.sendNotification(parsedUserId, response);
            } catch (Exception ex) {
                log.warn("Failed to send SSE notification", ex);
            }
        }

        if (pushEnabled) {
            try {
                String resolvedActionUrl = inAppActionUrl(actionUrl);
                Map<String, String> pushPayload = new HashMap<>();
                pushPayload.put("title", title);
                pushPayload.put("body", message);
                pushPayload.put("url", resolvedActionUrl);
                String payloadJson = objectMapper.writeValueAsString(pushPayload);
                webPushService.sendPushNotification(userId, payloadJson);
            } catch (Exception ex) {
                log.warn("Failed to send web push notification", ex);
            }
        }
    }

    private String tripUrl(String tripId) {
        return tripId == null || tripId.isBlank()
                ? DASHBOARD_PATH
                : "/dashboard/trips/" + tripId;
    }

    private String emailUrl(String actionUrl) {
        if (actionUrl == null || actionUrl.isBlank()) {
            return dashboardUrl();
        }

        String trimmed = actionUrl.trim();
        String normalizedBase = getNormalizedBaseUrl();
        if (trimmed.equals(normalizedBase) || trimmed.equals(normalizedBase + "/")) {
            return dashboardUrl();
        } else if (trimmed.startsWith(normalizedBase + "/")) {
            return trimmed;
        } else if (trimmed.startsWith("https://") || trimmed.startsWith("http://")
                || trimmed.startsWith("//")) {
            log.warn("Falling back to dashboard email URL because action URL is not internal");
            return dashboardUrl();
        }
        if (trimmed.startsWith("/")) {
            return normalizedBase + trimmed;
        }
        return normalizedBase + "/" + trimmed;
    }

    private String inAppActionUrl(String actionUrl) {
        if (actionUrl == null || actionUrl.isBlank()) {
            return actionUrl;
        }

        String trimmed = actionUrl.trim();
        String normalizedBase = getNormalizedBaseUrl();
        if (trimmed.equals(normalizedBase) || trimmed.equals(normalizedBase + "/")) {
            return DASHBOARD_PATH;
        }
        if (trimmed.startsWith(normalizedBase + "/")) {
            return trimmed.substring(normalizedBase.length());
        }
        return trimmed;
    }

    private String fallback(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value;
    }

    private String formatDateRange(String startDate, String endDate) {
        LocalDate start = parseDate(startDate);
        LocalDate end = parseDate(endDate);
        DateTimeFormatter formatter = DateTimeFormatter.ofPattern("MMM d, yyyy");
        if (start != null && end != null) {
            return start.format(formatter) + " – " + end.format(formatter);
        }
        if (start != null) {
            return start.format(formatter);
        }
        if (end != null) {
            return end.format(formatter);
        }
        return "";
    }

    private LocalDate parseDate(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return LocalDate.parse(value);
        } catch (DateTimeParseException ex) {
            return null;
        }
    }

    private String text(Map<?, ?> map, String... keys) {
        for (String key : keys) {
            Object value = map.get(key);
            if (value != null && !value.toString().isBlank()) {
                return value.toString();
            }
        }
        return null;
    }

    private String validUuidText(Map<?, ?> map, String... keys) {
        for (String key : keys) {
            String value = text(map, key);
            if (value == null) {
                continue;
            }
            try {
                UUID.fromString(value);
                return value;
            } catch (IllegalArgumentException ex) {
                log.warn("Ignoring notification UUID field={} because value is malformed",
                        LogSanitizer.safeDetail(key));
            }
        }
        return null;
    }

    private Map<String, Object> variables(Object... keyValues) {
        Map<String, Object> variables = new HashMap<>();
        for (int i = 0; i + 1 < keyValues.length; i += 2) {
            Object value = keyValues[i + 1];
            variables.put(keyValues[i].toString(), value == null ? "" : value);
        }
        return variables;
    }

    private Map<String, Object> metadata(Map<?, ?> map, String... keys) {
        Map<String, Object> metadata = new HashMap<>();
        for (String key : keys) {
            Object value = map.get(key);
            if (value != null) {
                metadata.put(key, value);
            }
        }
        return metadata;
    }

    private UUID uuid(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return UUID.fromString(value);
        } catch (IllegalArgumentException ex) {
            log.warn("Skipping notification because user id is not a UUID");
            return null;
        }
    }
}
