package pse.trippy.paymentservice.dto.response;

public record PaymentResponse(
        String transactionId,
        String status
) {
}