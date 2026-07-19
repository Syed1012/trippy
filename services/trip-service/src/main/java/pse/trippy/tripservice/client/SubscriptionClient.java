package pse.trippy.tripservice.client;

import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import pse.trippy.tripservice.dto.response.SubscriptionResponse;

@FeignClient(
        name = "subscriptionClient",
        url = "${payment.service.url}"   
)
public interface SubscriptionClient {

    @GetMapping("/payments/subscription")
    SubscriptionResponse getSubscription(@RequestHeader("X-User-Id") java.util.UUID userId);
}