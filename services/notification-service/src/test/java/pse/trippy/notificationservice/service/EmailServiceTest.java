package pse.trippy.notificationservice.service;

import jakarta.mail.Session;
import jakarta.mail.internet.MimeMessage;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mail.MailSendException;
import org.springframework.mail.javamail.JavaMailSender;
import org.thymeleaf.TemplateEngine;
import org.thymeleaf.spring6.SpringTemplateEngine;
import org.thymeleaf.templatemode.TemplateMode;
import org.thymeleaf.templateresolver.StringTemplateResolver;
import pse.trippy.notificationservice.model.entity.EmailLog;
import pse.trippy.notificationservice.model.enums.EmailStatus;
import pse.trippy.notificationservice.repository.EmailLogRepository;

import java.util.Map;
import java.util.Properties;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class EmailServiceTest {

    @Mock
    private JavaMailSender mailSender;

    @Mock
    private EmailLogRepository emailLogRepository;

    private EmailService emailService;

    @BeforeEach
    void setUp() {
        emailService = new EmailService(mailSender, stringTemplateEngine(), emailLogRepository, "no-reply@trippy.app");
    }

    @Test
    void sendTemplateEmail_sendsMessageAndPersistsSentLog() {
        MimeMessage message = mimeMessage();
        when(mailSender.createMimeMessage()).thenReturn(message);
        when(emailLogRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        emailService.sendTemplateEmail(
                "alice@example.com",
                "Welcome",
                "welcome",
                Map.of("userName", "Alice"));

        verify(mailSender).send(message);
        ArgumentCaptor<EmailLog> logCaptor = ArgumentCaptor.forClass(EmailLog.class);
        verify(emailLogRepository).save(logCaptor.capture());
        assertThat(logCaptor.getValue().getRecipient()).isEqualTo("alice@example.com");
        assertThat(logCaptor.getValue().getSubject()).isEqualTo("Welcome");
        assertThat(logCaptor.getValue().getTemplateName()).isEqualTo("welcome");
        assertThat(logCaptor.getValue().getStatus()).isEqualTo(EmailStatus.SENT);
        assertThat(logCaptor.getValue().getErrorMessage()).isNull();
    }

    @Test
    void sendTemplateEmail_persistsFailedLogWhenMailSenderFails() {
        MimeMessage message = mimeMessage();
        when(mailSender.createMimeMessage()).thenReturn(message);
        doThrow(new MailSendException("smtp down")).when(mailSender).send(message);
        when(emailLogRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        emailService.sendTemplateEmail(
                "alice@example.com",
                "Welcome",
                "welcome",
                Map.of("userName", "Alice"));

        verify(mailSender).send(message);
        ArgumentCaptor<EmailLog> logCaptor = ArgumentCaptor.forClass(EmailLog.class);
        verify(emailLogRepository).save(logCaptor.capture());
        assertThat(logCaptor.getValue().getStatus()).isEqualTo(EmailStatus.FAILED);
        assertThat(logCaptor.getValue().getErrorMessage()).contains("smtp down");
    }

    @Test
    void sendTemplateEmail_persistsFailedLogWhenTemplateNameIsUnsafe() {
        when(emailLogRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        emailService.sendTemplateEmail(
                "alice@example.com",
                "Welcome",
                "../welcome",
                Map.of("userName", "Alice"));

        verify(mailSender, never()).send(any(MimeMessage.class));
        ArgumentCaptor<EmailLog> logCaptor = ArgumentCaptor.forClass(EmailLog.class);
        verify(emailLogRepository).save(logCaptor.capture());
        assertThat(logCaptor.getValue().getStatus()).isEqualTo(EmailStatus.FAILED);
        assertThat(logCaptor.getValue().getErrorMessage()).contains("Invalid email template name");
    }

    private MimeMessage mimeMessage() {
        return new MimeMessage(Session.getInstance(new Properties()));
    }

    private TemplateEngine stringTemplateEngine() {
        SpringTemplateEngine engine = new SpringTemplateEngine();
        StringTemplateResolver resolver = new StringTemplateResolver();
        resolver.setTemplateMode(TemplateMode.HTML);
        engine.setTemplateResolver(resolver);
        return engine;
    }
}
