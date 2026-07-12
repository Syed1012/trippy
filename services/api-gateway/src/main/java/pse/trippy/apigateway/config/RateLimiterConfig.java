package pse.trippy.apigateway.config;

import org.springframework.cloud.gateway.filter.ratelimit.KeyResolver;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import reactor.core.publisher.Mono;

@Configuration
public class RateLimiterConfig {

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
                    return Mono.just("anonymous");
                }));
    }
}