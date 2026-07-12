package pse.trippy.tripservice.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalTime;

public record ActivityRequest(
        @NotBlank @Size(max = 200) String title,
        @Size(max = 2000) String description,
        @Size(max = 500) String location,
        LocalTime startTime,
        LocalTime endTime,
        @NotNull String category,
        @Size(max = 1000) String notes,
        BigDecimal estimatedCost,
        @Size(max = 8) String currency
) {
}
