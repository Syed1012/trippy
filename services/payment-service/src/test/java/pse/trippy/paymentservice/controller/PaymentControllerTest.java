package pse.trippy.paymentservice.controller;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import pse.trippy.paymentservice.config.GatewayHeaderAuthenticationFilter;
import pse.trippy.paymentservice.config.SecurityConfig;
import pse.trippy.paymentservice.dto.request.CheckoutRequest;
import pse.trippy.paymentservice.dto.request.PaymentConfirmationRequest;
import pse.trippy.paymentservice.dto.response.CheckoutResponse;
import pse.trippy.paymentservice.dto.response.PaymentConfirmationResponse;
import pse.trippy.paymentservice.dto.response.PlanResponse;
import pse.trippy.paymentservice.service.PaymentMethodService;
import pse.trippy.paymentservice.service.PaymentService;
import pse.trippy.paymentservice.service.SubscriptionService;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import com.fasterxml.jackson.databind.ObjectMapper;

@WebMvcTest(PaymentController.class)
@Import({SecurityConfig.class, GatewayHeaderAuthenticationFilter.class})
@ActiveProfiles("test")
@DisplayName("PaymentController")
class PaymentControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private PaymentService paymentService;

    @MockBean
    private SubscriptionService subscriptionService;

    @MockBean
    private PaymentMethodService paymentMethodService;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    @DisplayName("GET /payments/plans returns plan list (no auth required)")
    void getPlansReturnsOk() throws Exception {
        when(paymentService.getAvailablePlans()).thenReturn(List.of(
                PlanResponse.builder()
                        .planId("PREMIUM")
                        .displayName("Premium Plan")
                        .price(new BigDecimal("9.99"))
                        .currency("EUR")
                        .features(List.of("Up to 10 trips"))
                        .build(),
                PlanResponse.builder()
                        .planId("ENTERPRISE")
                        .displayName("Enterprise Plan")
                        .price(new BigDecimal("29.99"))
                        .currency("EUR")
                        .features(List.of("Unlimited trips"))
                        .build()
        ));

        mockMvc.perform(get("/payments/plans"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].planId").value("PREMIUM"))
                .andExpect(jsonPath("$[0].price").value(9.99))
                .andExpect(jsonPath("$[1].planId").value("ENTERPRISE"))
                .andExpect(jsonPath("$[1].price").value(29.99));
    }

    @Test
    @DisplayName("POST /payments/checkout returns transaction on success")
    void checkoutReturnsOk() throws Exception {
        UUID userId = UUID.randomUUID();
        UUID txnId = UUID.randomUUID();

        CheckoutResponse response = CheckoutResponse.builder()
                .transactionId(txnId)
                .status("COMPLETED")
                .build();

        when(paymentService.checkout(eq(userId), any(CheckoutRequest.class)))
                .thenReturn(response);

        String json = """
                {
                "planId": "premium_monthly",
                "paymentMethodId": "%s"
                }
                """.formatted(UUID.randomUUID());

        mockMvc.perform(post("/payments/checkout")
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("X-User-Id", userId.toString())
                        .content(json))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.transactionId").value(txnId.toString()))
                .andExpect(jsonPath("$.status").value("COMPLETED"));
    }

    @Test
    @DisplayName("POST /payments/checkout without auth returns 403")
    void checkoutWithoutAuthReturns401() throws Exception {
        CheckoutRequest request = CheckoutRequest.builder()
                .planId("PREMIUM")
                .paymentMethodId("pm_test_123")
                .build();

        mockMvc.perform(post("/payments/checkout")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @WithMockUser
    @DisplayName("POST /payments/checkout with empty planId returns 400")
    void checkoutEmptyPlanReturns400() throws Exception {
        String json = """
                {
                "planId": "",
                "paymentMethodId": "%s"
                }
                """.formatted(UUID.randomUUID());

        mockMvc.perform(post("/payments/checkout")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("X-User-Id", UUID.randomUUID().toString())
                        .content(json))
                .andExpect(status().isBadRequest());
    }
}
