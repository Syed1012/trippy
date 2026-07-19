package pse.trippy.notificationservice.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import pse.trippy.notificationservice.service.WebPushService;

import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(WebPushController.class)
class WebPushControllerTest {

    private static final String USER_ID = "f2e0cd70-c077-4c22-b4b2-94004a3d3b1f";
    private static final String ENDPOINT = "https://push.example.test/subscription";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private WebPushService webPushService;

    @Test
    void subscribeRejectsPayloadWithoutKeysBeforeItCanCauseAServerError() throws Exception {
        mockMvc.perform(post("/notifications/push/subscribe")
                        .header("X-User-Id", USER_ID)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"endpoint\":\"" + ENDPOINT + "\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void subscribeRequiresAuthenticatedUserContext() throws Exception {
        mockMvc.perform(post("/notifications/push/subscribe")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(validSubscriptionPayload()))
                .andExpect(status().isBadRequest());
    }

    @Test
    void subscribeStoresValidatedSubscriptionForAuthenticatedUser() throws Exception {
        mockMvc.perform(post("/notifications/push/subscribe")
                        .header("X-User-Id", USER_ID)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(validSubscriptionPayload()))
                .andExpect(status().isNoContent());

        verify(webPushService).subscribe(USER_ID, ENDPOINT, "p256dh-key", "auth-key");
    }

    @Test
    void unsubscribeUsesAuthenticatedUserContext() throws Exception {
        mockMvc.perform(post("/notifications/push/unsubscribe")
                        .header("X-User-Id", USER_ID)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(validSubscriptionPayload()))
                .andExpect(status().isNoContent());

        verify(webPushService).unsubscribe(USER_ID, ENDPOINT);
    }

    private String validSubscriptionPayload() throws Exception {
        return objectMapper.writeValueAsString(new SubscriptionPayload(
                ENDPOINT, new SubscriptionKeys("p256dh-key", "auth-key")));
    }

    private record SubscriptionPayload(String endpoint, SubscriptionKeys keys) {
    }

    private record SubscriptionKeys(String p256dh, String auth) {
    }
}
