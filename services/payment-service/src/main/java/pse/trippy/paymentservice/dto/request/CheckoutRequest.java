package pse.trippy.paymentservice.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CheckoutRequest {

    @NotBlank(message = "Plan ID is required")
    private String planId;

    @NotBlank(message = "Payment method ID is required")
    private String paymentMethodId;
}
