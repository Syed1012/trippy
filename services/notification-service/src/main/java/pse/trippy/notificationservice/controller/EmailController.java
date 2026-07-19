package pse.trippy.notificationservice.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import pse.trippy.notificationservice.dto.request.PasswordResetEmailRequest;
import pse.trippy.notificationservice.dto.request.SendEmailRequest;
import pse.trippy.notificationservice.dto.request.VerificationEmailRequest;
import pse.trippy.notificationservice.dto.request.WelcomeEmailRequest;
import pse.trippy.notificationservice.dto.response.EmailSentResponse;
import pse.trippy.notificationservice.service.EmailService;

import java.util.Map;

@RestController
@RequestMapping("/notifications/email")
@RequiredArgsConstructor
@Tag(name = "Email Dispatch", description = "Endpoints for triggering transactional HTML and plain text emails")
public class EmailController {

        private final EmailService emailService;

        @Value("${app.base-url:https://trippy.app}")
        private String appBaseUrl = "https://trippy.app";

        @Operation(summary = "Send custom template email", description = "Sends a custom Thymeleaf template email with dynamic key-value variables.")
        @ApiResponses(value = {
                        @ApiResponse(responseCode = "200", description = "Email successfully queued for delivery"),
                        @ApiResponse(responseCode = "400", description = "Invalid request payload")
        })
        @PostMapping("/send")
        public ResponseEntity<EmailSentResponse> sendEmail(
                        @RequestBody @Valid SendEmailRequest request) {
                emailService.sendTemplateEmail(
                                request.to(), request.subject(),
                                request.templateName(), request.templateVariables());
                return ResponseEntity.ok(new EmailSentResponse(true, "Email queued for delivery"));
        }

        @Operation(summary = "Send account verification email", description = "Sends an email verification code to a newly registered user.")
        @ApiResponses(value = {
                        @ApiResponse(responseCode = "200", description = "Verification email queued"),
                        @ApiResponse(responseCode = "400", description = "Invalid request parameters")
        })
        @PostMapping("/verification")
        public ResponseEntity<EmailSentResponse> sendVerification(
                        @RequestBody @Valid VerificationEmailRequest request) {
                emailService.sendTemplateEmail(
                                request.to(),
                                "Verify your Trippy account",
                                "email-verification",
                                Map.of("userName", request.userName(),
                                                "verificationCode", request.verificationCode()));
                return ResponseEntity.ok(new EmailSentResponse(true, "Verification email queued"));
        }

        @Operation(summary = "Send welcome email", description = "Sends a welcome email to newly verified users containing dashboard quick links.")
        @ApiResponses(value = {
                        @ApiResponse(responseCode = "200", description = "Welcome email queued"),
                        @ApiResponse(responseCode = "400", description = "Invalid request payload")
        })
        @PostMapping("/welcome")
        public ResponseEntity<EmailSentResponse> sendWelcome(
                        @RequestBody @Valid WelcomeEmailRequest request) {
                String dashboardUrl = request.dashboardUrl() != null
                                ? request.dashboardUrl()
                                : appBaseUrl + "/dashboard";
                emailService.sendTemplateEmail(
                                request.to(),
                                "Welcome to Trippy!",
                                "welcome",
                                Map.of("userName", request.userName(),
                                                "dashboardUrl", dashboardUrl));
                return ResponseEntity.ok(new EmailSentResponse(true, "Welcome email queued"));
        }

        @Operation(summary = "Send password reset email", description = "Sends a password reset link email to an existing user.")
        @ApiResponses(value = {
                        @ApiResponse(responseCode = "200", description = "Password reset email queued"),
                        @ApiResponse(responseCode = "400", description = "Invalid request payload")
        })
        @PostMapping("/password-reset")
        public ResponseEntity<EmailSentResponse> sendPasswordReset(
                        @RequestBody @Valid PasswordResetEmailRequest request) {
                emailService.sendTemplateEmail(
                                request.to(),
                                "Reset your Trippy password",
                                "password-reset",
                                Map.of("userName", request.userName(),
                                                "resetLink", request.resetLink()));
                return ResponseEntity.ok(new EmailSentResponse(true, "Password reset email queued"));
        }
}

