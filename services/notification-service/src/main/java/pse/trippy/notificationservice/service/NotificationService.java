package pse.trippy.notificationservice.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pse.trippy.notificationservice.dto.response.NotificationResponse;
import pse.trippy.notificationservice.logging.LogSanitizer;
import pse.trippy.notificationservice.model.entity.Notification;
import pse.trippy.notificationservice.model.enums.NotificationChannel;
import pse.trippy.notificationservice.model.enums.NotificationType;
import pse.trippy.notificationservice.repository.NotificationRepository;

import java.net.URI;
import java.net.URISyntaxException;
import java.net.URLDecoder;

import org.springframework.beans.factory.annotation.Value;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class NotificationService {

    private static final int DEFAULT_PAGE_SIZE = 20;
    private static final int MAX_PAGE_SIZE = 50;

    @Value("${app.base-url:https://trippy.app}")
    private String appBaseUrl = "https://trippy.app";

    private final NotificationRepository notificationRepository;

    @Transactional
    public Notification createNotification(UUID userId, NotificationType type, String title,
                                           String message, String actionUrl) {
        return createNotification(userId, type, title, message, actionUrl, null);
    }

    private String truncate(String value, int maxLen) {
        if (value == null) return null;
        return value.length() <= maxLen ? value : value.substring(0, maxLen);
    }

    @Transactional
    public Notification createNotification(UUID userId, NotificationType type, String title,
                                           String message, String actionUrl,
                                           Map<String, Object> metadata) {
        Notification notification = Notification.builder()
                .userId(userId)
                .type(type)
                .title(truncate(title == null || title.isBlank() ? "Notification" : title, 200))
                .message(truncate(message == null || message.isBlank() ? "New update" : message, 1000))
                .actionUrl(normalizeActionUrl(actionUrl))
                .metadata(metadata == null ? new HashMap<>() : new HashMap<>(metadata))
                .channel(NotificationChannel.IN_APP)
                .read(false)
                .build();

        Notification saved = notificationRepository.save(notification);
        log.info("Created in-app notification [{}] for user {}", type, userId);
        return saved;
    }

    @Transactional(readOnly = true)
    public Page<NotificationResponse> getNotifications(UUID userId, int page, int size) {
        return getNotifications(userId, page, size, false, null);
    }

    @Transactional(readOnly = true)
    public Page<NotificationResponse> getNotifications(UUID userId, int page, int size,
                                                       boolean unreadOnly, NotificationType type) {
        PageRequest pageRequest = PageRequest.of(
                Math.max(page, 0),
                boundedPageSize(size));

        Page<Notification> notifications;
        if (type != null && unreadOnly) {
            notifications = notificationRepository
                    .findByUserIdAndTypeAndReadFalseAndDeletedFalseOrderByCreatedAtDesc(
                            userId, type, pageRequest);
        } else if (type != null) {
            notifications = notificationRepository
                    .findByUserIdAndTypeAndDeletedFalseOrderByCreatedAtDesc(userId, type, pageRequest);
        } else if (unreadOnly) {
            notifications = notificationRepository
                    .findByUserIdAndReadFalseAndDeletedFalseOrderByCreatedAtDesc(userId, pageRequest);
        } else {
            notifications = notificationRepository
                    .findByUserIdAndDeletedFalseOrderByCreatedAtDesc(userId, pageRequest);
        }

        return notifications.map(this::toResponse);
    }

    @Transactional(readOnly = true)
    public long getUnreadCount(UUID userId) {
        return notificationRepository.countByUserIdAndReadFalseAndDeletedFalse(userId);
    }

    @Transactional
    public void markAsRead(UUID notificationId) {
        notificationRepository.findById(notificationId).ifPresent(n -> {
            n.setRead(true);
            if (n.getReadAt() == null) {
                n.setReadAt(Instant.now());
            }
            notificationRepository.save(n);
            log.info("Marked notification {} as read", notificationId);
        });
    }

    @Transactional
    public boolean markAsRead(UUID notificationId, UUID userId) {
        return notificationRepository.findByIdAndUserIdAndDeletedFalse(notificationId, userId)
                .map(n -> {
                    n.setRead(true);
                    if (n.getReadAt() == null) {
                        n.setReadAt(Instant.now());
                    }
                    notificationRepository.save(n);
                    log.info("Marked notification {} as read for user {}", notificationId, userId);
                    return true;
                })
                .orElse(false);
    }

    @Transactional
    public void markAllAsRead(UUID userId) {
        List<Notification> unread = notificationRepository
                .findByUserIdAndReadFalseAndDeletedFalseOrderByCreatedAtDesc(userId);
        Instant readAt = Instant.now();
        unread.forEach(n -> {
            n.setRead(true);
            n.setReadAt(readAt);
        });
        notificationRepository.saveAll(unread);
        log.info("Marked all notifications as read for user {}", userId);
    }

    @Transactional
    public boolean deleteNotification(UUID notificationId, UUID userId) {
        return notificationRepository.findByIdAndUserIdAndDeletedFalse(notificationId, userId)
                .map(n -> {
                    n.setDeleted(true);
                    notificationRepository.save(n);
                    log.info("Soft-deleted notification {} for user {}", notificationId, userId);
                    return true;
                })
                .orElse(false);
    }

    private NotificationResponse toResponse(Notification n) {
        return new NotificationResponse(
                n.getId(),
                n.getId(),
                n.getUserId(),
                n.getType(),
                n.getTitle(),
                n.getMessage(),
                n.getMessage(),
                n.getActionUrl(),
                n.getMetadata(),
                n.isRead(),
                n.getCreatedAt(),
                n.getReadAt()
        );
    }

    private int boundedPageSize(int requestedSize) {
        if (requestedSize <= 0) {
            return DEFAULT_PAGE_SIZE;
        }
        return Math.min(requestedSize, MAX_PAGE_SIZE);
    }

    private String normalizeActionUrl(String actionUrl) {
        if (actionUrl == null || actionUrl.isBlank()) {
            return null;
        }

        String trimmed = actionUrl.trim();
        try {
            URI uri = new URI(trimmed);
            String effectiveBaseUrl = (appBaseUrl == null || appBaseUrl.isBlank()) ? "https://trippy.app" : appBaseUrl;
            URI baseUri = URI.create(effectiveBaseUrl);
            String appHost = baseUri.getHost();
            String expectedScheme = baseUri.getScheme();

            if (appHost == null || expectedScheme == null) {
                log.warn("Invalid app.base-url configuration appBaseUrl={}", LogSanitizer.safeDetail(effectiveBaseUrl));
                return null;
            }

            if (uri.isAbsolute()) {
                if (!expectedScheme.equalsIgnoreCase(uri.getScheme())
                        || !appHost.equalsIgnoreCase(uri.getHost())) {
                    log.warn("Dropping unsafe notification action URL reason=external-or-non-https");
                    return null;
                }
                return normalizeInternalPath(uri);
            }

            if (trimmed.startsWith("//")) {
                log.warn("Dropping unsafe notification action URL reason=protocol-relative");
                return null;
            }
            return normalizeInternalPath(uri);
        } catch (URISyntaxException | IllegalArgumentException ex) {
            log.warn("Dropping invalid notification action URL error={}", LogSanitizer.safeError(ex));
            return null;
        }
    }

    private String normalizeInternalPath(URI uri) {
        String path = uri.getRawPath();
        if (path == null || path.isBlank() || !path.startsWith("/") || containsParentTraversal(path)) {
            log.warn("Dropping unsafe notification action URL reason=invalid-path");
            return null;
        }

        StringBuilder normalized = new StringBuilder(path);
        if (uri.getRawQuery() != null) {
            normalized.append('?').append(uri.getRawQuery());
        }
        if (uri.getRawFragment() != null) {
            normalized.append('#').append(uri.getRawFragment());
        }
        return normalized.toString();
    }

    private boolean containsParentTraversal(String path) {
        String decodedPath = URLDecoder.decode(path, StandardCharsets.UTF_8);
        return Arrays.asList(decodedPath.split("/")).contains("..");
    }
}
