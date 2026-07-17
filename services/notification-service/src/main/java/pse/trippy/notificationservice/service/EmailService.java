package pse.trippy.notificationservice.service;

import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import lombok.extern.slf4j.Slf4j;
import org.springframework.mail.MailException;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.web.util.HtmlUtils;
import org.thymeleaf.TemplateEngine;
import org.thymeleaf.context.Context;
import pse.trippy.notificationservice.model.entity.EmailLog;
import pse.trippy.notificationservice.model.enums.EmailStatus;
import pse.trippy.notificationservice.logging.LogSanitizer;
import pse.trippy.notificationservice.repository.EmailLogRepository;

import org.springframework.beans.factory.annotation.Value;
import java.util.Map;
import java.util.regex.Pattern;

@Service
@Slf4j
public class EmailService {

    private static final Pattern SAFE_TEMPLATE_NAME = Pattern.compile("[a-z0-9-]+");
    private static final int MAX_ERROR_MESSAGE_LENGTH = 2000;

    private final JavaMailSender mailSender;
    private final TemplateEngine templateEngine;
    private final EmailLogRepository emailLogRepository;
    private final String fromAddress;

    public EmailService(JavaMailSender mailSender,
                        TemplateEngine templateEngine,
                        EmailLogRepository emailLogRepository,
                        @Value("${spring.mail.username:no-reply@trippy.app}") String fromAddress) {
        this.mailSender = mailSender;
        this.templateEngine = templateEngine;
        this.emailLogRepository = emailLogRepository;
        this.fromAddress = fromAddress;
    }

    @Async("emailExecutor")
    public void sendTemplateEmail(String to, String subject, String templateName,
                                  Map<String, Object> variables) {
        try {
            Context context = new Context();
            context.setVariables(variables == null ? Map.of() : variables);

            String htmlBody = templateEngine.process(templatePath(templateName), context);
            sendHtmlEmail(to, subject, templateName, htmlBody);
        } catch (RuntimeException ex) {
            log.error("Failed to render email recipient={} template={} error={}",
                    LogSanitizer.maskEmail(to), LogSanitizer.safeDetail(templateName), LogSanitizer.safeError(ex));
            persistEmailLog(to, subject, templateName, EmailStatus.FAILED, errorMessage(ex));
        }
    }

    public String renderTemplate(String templateName, Map<String, Object> variables) {
        Context context = new Context();
        context.setVariables(variables);
        return templateEngine.process(templatePath(templateName), context);
    }

    public String renderPlainText(String templateName, Map<String, Object> variables) {
        return toPlainText(renderTemplate(templateName, variables));
    }

    private void sendHtmlEmail(String to, String subject, String templateName, String htmlBody) {
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
            helper.setTo(to);
            helper.setFrom(fromAddress, "Trippy");
            helper.setReplyTo(fromAddress);
            helper.setSubject(subject);
            helper.setText(toPlainText(htmlBody), htmlBody);

            // Add headers to satisfy spam filters & prevent out-of-office loops
            message.addHeader("Auto-Submitted", "auto-generated");
            message.addHeader("X-Auto-Response-Suppress", "All");

            mailSender.send(message);

            persistEmailLog(to, subject, templateName, EmailStatus.SENT, null);

            log.info("Email sent recipient={} template={}", LogSanitizer.maskEmail(to), templateName);

        } catch (MessagingException | MailException | java.io.UnsupportedEncodingException e) {
            log.error("Failed to send email recipient={} template={} error={}",
                    LogSanitizer.maskEmail(to), templateName, LogSanitizer.safeError(e));

            persistEmailLog(to, subject, templateName, EmailStatus.FAILED, errorMessage(e));
        }
    }

    private void persistEmailLog(String to, String subject, String templateName,
                                 EmailStatus status, String errorMessage) {
        try {
            emailLogRepository.save(EmailLog.builder()
                    .recipient(to)
                    .subject(subject)
                    .templateName(templateName)
                    .status(status)
                    .errorMessage(errorMessage)
                    .build());
        } catch (RuntimeException ex) {
            log.warn("Failed to persist email log recipient={} template={} status={} error={}",
                    LogSanitizer.maskEmail(to), LogSanitizer.safeDetail(templateName), status, LogSanitizer.safeError(ex));
        }
    }

    private String errorMessage(Throwable throwable) {
        String message = throwable.getMessage();
        if (message == null || message.isBlank()) {
            message = throwable.getClass().getSimpleName();
        }
        return message.length() <= MAX_ERROR_MESSAGE_LENGTH
                ? message
                : message.substring(0, MAX_ERROR_MESSAGE_LENGTH);
    }

    private String toPlainText(String htmlBody) {
        String withoutTags = htmlBody
                .replaceAll("(?is)<style.*?</style>", " ")
                .replaceAll("(?is)<script.*?</script>", " ")
                .replaceAll("(?i)<br\\s*/?>", "\n")
                .replaceAll("(?i)</p>", "\n")
                .replaceAll("<[^>]+>", " ")
                .replaceAll("[ \\t\\x0B\\f\\r]+", " ")
                .replaceAll("\\n\\s+", "\n")
                .trim();
        return HtmlUtils.htmlUnescape(withoutTags);
    }

    private String templatePath(String templateName) {
        if (templateName == null || !SAFE_TEMPLATE_NAME.matcher(templateName).matches()) {
            throw new IllegalArgumentException("Invalid email template name");
        }
        return "email/" + templateName;
    }
}
