package pse.trippy.tripservice.dto.request;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record InviteByEmailRequest(
        @NotBlank
        @Email
        @Size(max = 254)
        String email,

        @Size(max = 300)
        String message,

        @Size(max = 200)
        String inviterName
) {
}
