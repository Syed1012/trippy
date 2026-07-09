package pse.trippy.paymentservice.dto;

public record PaymentResponse(
        String transactionId,
        String status
) {
}