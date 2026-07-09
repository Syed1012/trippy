package pse.trippy.apigateway.config;

import org.springframework.cloud.gateway.filter.ratelimit.KeyResolver;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import reactor.core.publisher.Mono;

@Configuration
public class RateLimiterConfig {

    /**
     * A KeyResolver that uses the authenticated principal's name for rate limiting.
     * For unauthenticated requests, it falls back to the remote IP address.
     * This provides a fair rate limit per user, while still protecting against
     * anonymous traffic spikes.
     */
    @Bean
    @Primary
    public KeyResolver userOrIpKeyResolver() {
        return exchange -> exchange.getPrincipal()
                .flatMap(principal -> Mono.just(principal.getName()))
                .switchIfEmpty(Mono.defer(() -> {
                    var remoteAddress = exchange.getRequest().getRemoteAddress();
                    if (remoteAddress != null && remoteAddress.getAddress() != null) {
                        return Mono.just(remoteAddress.getAddress().getHostAddress());
                    }
                    // Fallback to a generic key if IP is not available
                    return Mono.just("anonymous");
                }));
    }
}