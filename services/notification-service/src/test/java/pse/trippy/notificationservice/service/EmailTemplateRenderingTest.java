package pse.trippy.notificationservice.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mail.javamail.JavaMailSender;
import org.thymeleaf.TemplateEngine;
import org.thymeleaf.context.Context;
import org.thymeleaf.spring6.SpringTemplateEngine;
import org.thymeleaf.templatemode.TemplateMode;
import org.thymeleaf.templateresolver.ClassLoaderTemplateResolver;
import pse.trippy.notificationservice.repository.EmailLogRepository;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;

@DisplayName("Email template rendering")
class EmailTemplateRenderingTest {

    private TemplateEngine templateEngine;

    private EmailService emailService;

    @BeforeEach
    void setUp() {
        ClassLoaderTemplateResolver templateResolver = new ClassLoaderTemplateResolver();
        templateResolver.setPrefix("templates/");
        templateResolver.setSuffix(".html");
        templateResolver.setTemplateMode(TemplateMode.HTML);
        templateResolver.setCharacterEncoding("UTF-8");

        templateEngine = new SpringTemplateEngine();
        templateEngine.setTemplateResolver(templateResolver);
        emailService = new EmailService(
                mock(JavaMailSender.class),
                templateEngine,
                mock(EmailLogRepository.class),
                "no-reply@trippy.app");
    }

    private String render(String template, Map<String, Object> variables) {
        Context ctx = new Context();
        ctx.setVariables(variables);
        return templateEngine.process("email/" + template, ctx);
    }

    @Test
    @DisplayName("welcome template renders with user name and dashboard URL")
    void welcomeTemplate() {
        String html = render("welcome", Map.of(
                "userName", "Alice",
                "dashboardUrl", "https://trippy.app/dashboard"));

        assertThat(html).contains("Alice");
        assertThat(html).contains("https://trippy.app/dashboard");
        assertThat(html).contains("Welcome to Trippy");
    }

    @Test
    @DisplayName("email-verification template renders with code")
    void verificationTemplate() {
        String html = render("email-verification", Map.of(
                "userName", "Bob",
                "verificationCode", "482916"));

        assertThat(html).contains("Bob");
        assertThat(html).contains("482916");
        assertThat(html).contains("15 minutes");
    }

    @Test
    @DisplayName("password-reset template renders with reset link")
    void passwordResetTemplate() {
        String html = render("password-reset", Map.of(
                "userName", "Carol",
                "resetLink", "https://trippy.app/reset?token=abc123"));

        assertThat(html).contains("Carol");
        assertThat(html).contains("https://trippy.app/reset?token=abc123");
        assertThat(html).contains("1 hour");
    }

    @Test
    @DisplayName("trip-invitation template renders trip context")
    void tripInvitationTemplate() {
        String html = render("trip-invitation", Map.of(
                "inviteeName", "Dev",
                "inviterName", "Mira",
                "tripTitle", "Berlin Weekend",
                "dashboardUrl", "https://trippy.app/dashboard"));

        assertThat(html).contains("Dev");
        assertThat(html).contains("Mira");
        assertThat(html).contains("Berlin Weekend");
    }

    @Test
    @DisplayName("trip-invite template renders trip context")
    void tripInviteTemplate() {
        String html = render("trip-invite", Map.of(
                "inviteeName", "Dev",
                "inviterName", "Mira",
                "tripTitle", "Berlin Weekend",
                "dashboardUrl", "https://trippy.app/dashboard"));

        assertThat(html).contains("Dev");
        assertThat(html).contains("Mira");
        assertThat(html).contains("Berlin Weekend");
    }

    @Test
    @DisplayName("trip-joined template renders trip context")
    void tripJoinedTemplate() {
        String html = render("trip-joined", Map.of(
                "inviterName", "Mira",
                "inviteeName", "Dev",
                "tripTitle", "Berlin Weekend",
                "dashboardUrl", "https://trippy.app/dashboard"));

        assertThat(html).contains("Mira");
        assertThat(html).contains("Dev");
        assertThat(html).contains("Berlin Weekend");
    }

    @Test
    @DisplayName("payment-success template renders payment details")
    void paymentSuccessTemplate() {
        String html = render("payment-success", Map.of(
                "userName", "Dev",
                "amount", "19.99",
                "planName", "Premium",
                "dashboardUrl", "https://trippy.app/dashboard"));

        assertThat(html).contains("Payment Successful");
        assertThat(html).contains("19.99");
        assertThat(html).contains("Premium");
    }

    @Test
    @DisplayName("payment-failed template renders retry CTA")
    void paymentFailedTemplate() {
        String html = render("payment-failed", Map.of(
                "userName", "Dev",
                "dashboardUrl", "https://trippy.app/dashboard"));

        assertThat(html).contains("Payment Failed");
        assertThat(html).contains("Dev");
        assertThat(html).contains("https://trippy.app/dashboard");
    }

    @Test
    @DisplayName("itinerary-ready template renders trip link")
    void itineraryReadyTemplate() {
        String html = render("itinerary-ready", Map.of(
                "userName", "Dev",
                "tripTitle", "Kyoto Spring",
                "destination", "Kyoto",
                "tripUrl", "https://trippy.app/dashboard/trips/kyoto"));

        assertThat(html).contains("Kyoto Spring");
        assertThat(html).contains("Kyoto");
        assertThat(html).contains("https://trippy.app/dashboard/trips/kyoto");
    }

    @Test
    @DisplayName("system-notification template renders message")
    void systemNotificationTemplate() {
        String html = render("system-notification", Map.of(
                "userName", "Dev",
                "title", "Trippy update",
                "message", "Your account settings changed.",
                "actionUrl", "https://trippy.app/dashboard"));

        assertThat(html).contains("Trippy update");
        assertThat(html).contains("Your account settings changed.");
        assertThat(html).contains("https://trippy.app/dashboard");
    }

    @Test
    @DisplayName("plain-text fallback is rendered from HTML template")
    void plainTextFallback() {
        String text = emailService.renderPlainText("trip-invite", Map.of(
                "inviteeName", "Dev",
                "inviterName", "Mira",
                "tripTitle", "Berlin Weekend",
                "dashboardUrl", "https://trippy.app/dashboard"));

        assertThat(text).contains("Dev");
        assertThat(text).contains("Mira");
        assertThat(text).contains("Berlin Weekend");
        assertThat(text).doesNotContain("<html");
    }

    @Test
    @DisplayName("renderTemplate rejects unsafe template names")
    void renderTemplateRejectsUnsafeTemplateNames() {
        assertThatThrownBy(() -> emailService.renderTemplate("../welcome", Map.of()))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
