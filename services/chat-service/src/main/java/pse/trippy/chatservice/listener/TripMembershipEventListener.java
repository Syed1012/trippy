package pse.trippy.chatservice.listener;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Component;
import pse.trippy.chatservice.config.ChatEventRabbitConfig;
import pse.trippy.chatservice.model.enums.MessageType;
import pse.trippy.chatservice.service.ChatMessageService;

import java.util.Map;
import java.util.UUID;

@Component
@RequiredArgsConstructor
@Slf4j
public class TripMembershipEventListener {

    private final ChatMessageService chatMessageService;

    @RabbitListener(queues = ChatEventRabbitConfig.MEMBERSHIP_QUEUE)
    public void handleMembershipEvent(Map<String, Object> event) {
        try {
            String eventType = String.valueOf(event.get("eventType"));
            UUID tripId = UUID.fromString(String.valueOf(event.get("tripId")));
            UUID userId = UUID.fromString(String.valueOf(event.get("userId")));
            String displayName = event.get("displayName") instanceof String name && !name.isBlank()
                    ? name
                    : "A participant";

            String content = switch (eventType) {
                case "trip.participant.joined" -> displayName + " joined the chat";
                case "trip.participant.left" -> displayName + " left the chat";
                default -> null;
            };

            if (content != null) {
                chatMessageService.sendMessage(
                        tripId, userId, "System", content, MessageType.SYSTEM);
            }
        } catch (RuntimeException exception) {
            log.warn("Ignoring invalid trip membership event: {}", event, exception);
        }
    }
}