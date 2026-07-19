package pse.trippy.tripservice.config;

import org.springframework.amqp.core.Binding;
import org.springframework.amqp.core.BindingBuilder;
import org.springframework.amqp.core.Queue;
import org.springframework.amqp.core.TopicExchange;
import org.springframework.amqp.support.converter.Jackson2JsonMessageConverter;
import org.springframework.amqp.support.converter.MessageConverter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class RabbitMQConfig {

    public static final String TRIP_EXCHANGE = "trippy.events";
    public static final String USER_EVENTS_EXCHANGE = "user.events";
    public static final String USER_REGISTERED_QUEUE = "trip-service.user.registered";

    @Bean
    public TopicExchange tripExchange() {
        return new TopicExchange(TRIP_EXCHANGE);
    }

    @Bean
    public TopicExchange userEventsExchange() {
        return new TopicExchange(USER_EVENTS_EXCHANGE);
    }

    @Bean
    public Queue userRegisteredQueue() {
        return new Queue(USER_REGISTERED_QUEUE, true);
    }

    @Bean
    public Binding userRegisteredBinding(Queue userRegisteredQueue, TopicExchange userEventsExchange) {
        return BindingBuilder.bind(userRegisteredQueue).to(userEventsExchange).with("user.registered");
    }

    @Bean
    public MessageConverter jackson2JsonMessageConverter() {
        return new Jackson2JsonMessageConverter();
    }
}
