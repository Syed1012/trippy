package pse.trippy.notificationservice.config;

import org.springframework.amqp.core.Binding;
import org.springframework.amqp.core.BindingBuilder;
import org.springframework.amqp.core.Queue;
import org.springframework.amqp.core.QueueBuilder;
import org.springframework.amqp.core.TopicExchange;
import org.springframework.amqp.rabbit.config.SimpleRabbitListenerContainerFactory;
import org.springframework.amqp.rabbit.connection.ConnectionFactory;
import org.springframework.amqp.support.converter.DefaultClassMapper;
import org.springframework.amqp.support.converter.Jackson2JsonMessageConverter;
import org.springframework.amqp.support.converter.MessageConverter;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class RabbitMQConfig {

    public static final String EXCHANGE = "trippy.events";
    public static final String QUEUE = "notification.events";
    public static final String DLQ = "notification.events.dlq";

    public static final String ROUTING_USER_REGISTERED = "user.registered";
    public static final String ROUTING_PASSWORD_RESET = "user.password.reset";
    public static final String ROUTING_TRIP_INVITATION = "trip.invitation.created";
    public static final String ROUTING_TRIP_PARTICIPANT_INVITED = "trip.participant.invited";
    public static final String ROUTING_INVITATION_ACCEPTED = "trip.invitation.accepted";
    public static final String ROUTING_PARTICIPANT_JOINED = "trip.participant.joined";
    public static final String ROUTING_PARTICIPANT_DECLINED = "trip.participant.declined";
    public static final String ROUTING_PARTICIPANT_REJECTED = "trip.participant.rejected";
    public static final String ROUTING_TRIP_UPDATED = "trip.updated";
    public static final String ROUTING_PAYMENT_COMPLETED = "payment.completed";
    public static final String ROUTING_PAYMENT_FAILED = "payment.failed";
    public static final String ROUTING_ITINERARY_READY = "ai.itinerary.ready";
    public static final String ROUTING_ITINERARY_GENERATED = "ai.itinerary.generated";
    public static final String ROUTING_SYSTEM_NOTIFICATION = "system.notification";
    public static final String ROUTING_JOIN_REQUESTED = "trip.participant.join_requested";
    public static final String ROUTING_INVITE_PROPOSED = "trip.participant.invite_proposed";
    public static final String ROUTING_JOIN_APPROVED = "trip.participant.approved";
    public static final String ROUTING_CHAT_MESSAGE_SENT = "chat.message.sent";

    @Bean
    public TopicExchange trippyExchange() {
        return new TopicExchange(EXCHANGE, true, false);
    }

    @Bean
    public Queue deadLetterQueue() {
        return QueueBuilder.durable(DLQ).build();
    }

    @Bean
    public Queue notificationQueue() {
        return QueueBuilder.durable(QUEUE)
                .withArgument("x-dead-letter-exchange", "")
                .withArgument("x-dead-letter-routing-key", DLQ)
                .build();
    }

    @Bean
    public Binding userRegisteredBinding(Queue notificationQueue, TopicExchange trippyExchange) {
        return BindingBuilder.bind(notificationQueue)
                .to(trippyExchange)
                .with(ROUTING_USER_REGISTERED);
    }

    @Bean
    public Binding passwordResetBinding(Queue notificationQueue, TopicExchange trippyExchange) {
        return BindingBuilder.bind(notificationQueue)
                .to(trippyExchange)
                .with(ROUTING_PASSWORD_RESET);
    }

    @Bean
    public Binding tripInvitationBinding(Queue notificationQueue, TopicExchange trippyExchange) {
        return BindingBuilder.bind(notificationQueue)
                .to(trippyExchange)
                .with(ROUTING_TRIP_INVITATION);
    }

    @Bean
    public Binding tripParticipantInvitedBinding(Queue notificationQueue, TopicExchange trippyExchange) {
        return BindingBuilder.bind(notificationQueue)
                .to(trippyExchange)
                .with(ROUTING_TRIP_PARTICIPANT_INVITED);
    }

    @Bean
    public Binding invitationAcceptedBinding(Queue notificationQueue, TopicExchange trippyExchange) {
        return BindingBuilder.bind(notificationQueue)
                .to(trippyExchange)
                .with(ROUTING_INVITATION_ACCEPTED);
    }

    @Bean
    public Binding participantJoinedBinding(Queue notificationQueue, TopicExchange trippyExchange) {
        return BindingBuilder.bind(notificationQueue)
                .to(trippyExchange)
                .with(ROUTING_PARTICIPANT_JOINED);
    }

    @Bean
    public Binding participantDeclinedBinding(Queue notificationQueue, TopicExchange trippyExchange) {
        return BindingBuilder.bind(notificationQueue)
                .to(trippyExchange)
                .with(ROUTING_PARTICIPANT_DECLINED);
    }

    @Bean
    public Binding participantRejectedBinding(Queue notificationQueue, TopicExchange trippyExchange) {
        return BindingBuilder.bind(notificationQueue)
                .to(trippyExchange)
                .with(ROUTING_PARTICIPANT_REJECTED);
    }

    @Bean
    public Binding tripUpdatedBinding(Queue notificationQueue, TopicExchange trippyExchange) {
        return BindingBuilder.bind(notificationQueue)
                .to(trippyExchange)
                .with(ROUTING_TRIP_UPDATED);
    }

    @Bean
    public Binding paymentCompletedBinding(Queue notificationQueue, TopicExchange trippyExchange) {
        return BindingBuilder.bind(notificationQueue)
                .to(trippyExchange)
                .with(ROUTING_PAYMENT_COMPLETED);
    }

    @Bean
    public Binding paymentFailedBinding(Queue notificationQueue, TopicExchange trippyExchange) {
        return BindingBuilder.bind(notificationQueue)
                .to(trippyExchange)
                .with(ROUTING_PAYMENT_FAILED);
    }

    @Bean
    public Binding itineraryReadyBinding(Queue notificationQueue, TopicExchange trippyExchange) {
        return BindingBuilder.bind(notificationQueue)
                .to(trippyExchange)
                .with(ROUTING_ITINERARY_READY);
    }

    @Bean
    public Binding itineraryGeneratedBinding(Queue notificationQueue, TopicExchange trippyExchange) {
        return BindingBuilder.bind(notificationQueue)
                .to(trippyExchange)
                .with(ROUTING_ITINERARY_GENERATED);
    }

    @Bean
    public Binding systemNotificationBinding(Queue notificationQueue, TopicExchange trippyExchange) {
        return BindingBuilder.bind(notificationQueue)
                .to(trippyExchange)
                .with(ROUTING_SYSTEM_NOTIFICATION);
    }

    @Bean
    public Binding joinRequestedBinding(Queue notificationQueue, TopicExchange trippyExchange) {
        return BindingBuilder.bind(notificationQueue)
                .to(trippyExchange)
                .with(ROUTING_JOIN_REQUESTED);
    }

    @Bean
    public Binding inviteProposedBinding(Queue notificationQueue, TopicExchange trippyExchange) {
        return BindingBuilder.bind(notificationQueue)
                .to(trippyExchange)
                .with(ROUTING_INVITE_PROPOSED);
    }

    @Bean
    public Binding joinApprovedBinding(Queue notificationQueue, TopicExchange trippyExchange) {
        return BindingBuilder.bind(notificationQueue)
                .to(trippyExchange)
                .with(ROUTING_JOIN_APPROVED);
    }

    @Bean
    public Binding chatMessageSentBinding(Queue notificationQueue, TopicExchange trippyExchange) {
        return BindingBuilder.bind(notificationQueue)
                .to(trippyExchange)
                .with(ROUTING_CHAT_MESSAGE_SENT);
    }

    @Bean
    public MessageConverter jsonMessageConverter() {
        Jackson2JsonMessageConverter converter = new Jackson2JsonMessageConverter();
        converter.setClassMapper(trustedClassMapper());
        return converter;
    }

    @Bean
    public DefaultClassMapper trustedClassMapper() {
        DefaultClassMapper classMapper = new DefaultClassMapper();
        classMapper.setTrustedPackages("java.util", "pse.trippy");
        return classMapper;
    }

    @Bean
    @ConditionalOnBean(ConnectionFactory.class)
    public SimpleRabbitListenerContainerFactory rabbitListenerContainerFactory(
            ConnectionFactory connectionFactory,
            MessageConverter jsonMessageConverter,
            org.springframework.boot.autoconfigure.amqp.SimpleRabbitListenerContainerFactoryConfigurer configurer) {
        SimpleRabbitListenerContainerFactory factory = new SimpleRabbitListenerContainerFactory();
        configurer.configure(factory, connectionFactory);
        factory.setMessageConverter(jsonMessageConverter);
        return factory;
    }
}
