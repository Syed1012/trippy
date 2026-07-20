package pse.trippy.chatservice.config;

import org.springframework.amqp.core.Binding;
import org.springframework.amqp.core.BindingBuilder;
import org.springframework.amqp.core.Queue;
import org.springframework.amqp.core.TopicExchange;
import org.springframework.amqp.support.converter.Jackson2JsonMessageConverter;
import org.springframework.amqp.support.converter.MessageConverter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class ChatEventRabbitConfig {

    public static final String TRIP_EXCHANGE = "trippy.events";
    public static final String MEMBERSHIP_QUEUE = "chat.membership.events";
    public static final String CHAT_MESSAGE_ROUTING_KEY = "chat.message.sent";

    @Bean
    TopicExchange chatTripExchange() {
        return new TopicExchange(TRIP_EXCHANGE);
    }

    @Bean
    Queue chatMembershipQueue() {
        return new Queue(MEMBERSHIP_QUEUE, true);
    }

    @Bean
    Binding joinedMembershipBinding(Queue chatMembershipQueue, TopicExchange chatTripExchange) {
        return BindingBuilder.bind(chatMembershipQueue)
                .to(chatTripExchange)
                .with("trip.participant.joined");
    }

    @Bean
    Binding leftMembershipBinding(Queue chatMembershipQueue, TopicExchange chatTripExchange) {
        return BindingBuilder.bind(chatMembershipQueue)
                .to(chatTripExchange)
                .with("trip.participant.left");
    }

    @Bean
    MessageConverter chatEventMessageConverter() {
        return new Jackson2JsonMessageConverter();
    }
}