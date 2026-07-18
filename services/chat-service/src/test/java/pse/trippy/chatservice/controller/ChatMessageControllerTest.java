package pse.trippy.chatservice.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import pse.trippy.chatservice.client.TripServiceClient;
import pse.trippy.chatservice.dto.request.SendMessageRequest;
import pse.trippy.chatservice.dto.response.ChatMessageResponse;
import pse.trippy.chatservice.dto.response.MessageHistoryResponse;
import pse.trippy.chatservice.service.ChatMessageService;
import pse.trippy.chatservice.service.FileStorageService;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(ChatMessageController.class)
@AutoConfigureMockMvc(addFilters = false)
@DisplayName("ChatMessageController")
class ChatMessageControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private ChatMessageService chatMessageService;

    @MockBean
    private FileStorageService fileStorageService;

    @MockBean
    private pse.trippy.chatservice.repository.MessageAttachmentRepository attachmentRepository;

        @MockBean
        private TripServiceClient tripServiceClient;

    @Test
    @DisplayName("POST /trips/{tripId}/chat/messages returns 201")
    void sendMessageReturnsCreated() throws Exception {
        UUID tripId = UUID.randomUUID();
        UUID msgId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();

        when(tripServiceClient.isParticipant(tripId, userId)).thenReturn(true);
        when(chatMessageService.sendMessage(eq(tripId), any(), anyString(), anyString(), any()))
                .thenReturn(ChatMessageResponse.builder()
                        .id(msgId)
                        .senderId(UUID.randomUUID())
                        .senderDisplayName("Alice")
                        .content("Hello!")
                        .type("TEXT")
                        .createdAt(Instant.now())
                        .edited(false)
                        .build());

        SendMessageRequest request = SendMessageRequest.builder()
                .content("Hello!")
                .type("TEXT")
                .build();

        mockMvc.perform(post("/trips/{tripId}/chat/messages", tripId)
                        .header("X-User-Id", userId)
                        .header("X-User-DisplayName", "Alice")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(msgId.toString()))
                .andExpect(jsonPath("$.content").value("Hello!"))
                .andExpect(jsonPath("$.type").value("TEXT"));
    }

    @Test
    @DisplayName("POST returns 400 for empty content")
    void returnsBadRequestForEmptyContent() throws Exception {
        UUID tripId = UUID.randomUUID();

        String json = "{\"content\": \"\", \"type\": \"TEXT\"}";

        mockMvc.perform(post("/trips/{tripId}/chat/messages", tripId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("GET /trips/{tripId}/chat/messages returns paginated history")
    void getMessageHistoryReturnsPaginatedHistory() throws Exception {
        UUID tripId = UUID.randomUUID();
        UUID msgId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();

        MessageHistoryResponse historyResponse = MessageHistoryResponse.builder()
                .messages(List.of(ChatMessageResponse.builder()
                        .id(msgId)
                        .senderId(UUID.randomUUID())
                        .senderDisplayName("Alice")
                        .content("Hello!")
                        .type("TEXT")
                        .createdAt(Instant.now())
                        .edited(false)
                        .build()))
                .page(0)
                .size(50)
                .totalMessages(1)
                .hasMore(false)
                .build();

        when(tripServiceClient.isParticipant(tripId, userId)).thenReturn(true);
        when(chatMessageService.getMessageHistory(eq(tripId), eq(0), eq(50), any()))
                .thenReturn(historyResponse);

        mockMvc.perform(get("/trips/{tripId}/chat/messages", tripId)
                        .header("X-User-Id", userId)
                        .param("page", "0")
                        .param("size", "50"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.messages").isArray())
                .andExpect(jsonPath("$.messages[0].id").value(msgId.toString()))
                .andExpect(jsonPath("$.messages[0].content").value("Hello!"))
                .andExpect(jsonPath("$.page").value(0))
                .andExpect(jsonPath("$.size").value(50))
                .andExpect(jsonPath("$.totalMessages").value(1))
                .andExpect(jsonPath("$.hasMore").value(false));
    }

        @Test
        @DisplayName("GET rejects users who are not trip participants")
        void getMessageHistoryRejectsNonParticipant() throws Exception {
                UUID tripId = UUID.randomUUID();
                UUID userId = UUID.randomUUID();
                when(tripServiceClient.isParticipant(tripId, userId)).thenReturn(false);

                mockMvc.perform(get("/trips/{tripId}/chat/messages", tripId)
                                                .header("X-User-Id", userId))
                                .andExpect(status().isForbidden());
        }
}
