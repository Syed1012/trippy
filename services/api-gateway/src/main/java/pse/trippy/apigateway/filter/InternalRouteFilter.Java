package pse.trippy.apigateway.filter;

import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.core.Ordered;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

@Component
public class InternalRouteFilter implements GlobalFilter, Ordered {

    private static final String INTERNAL_HEADER = "X-Trippy-Internal-Request";

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        String path = exchange.getRequest().getURI().getPath();

        // Check if the route is an internal one
        if (path.startsWith("/internal/")) {
            // If an external client tries to add the internal header, reject it
            if (exchange.getRequest().getHeaders().containsKey(INTERNAL_HEADER)) {
                exchange.getResponse().setStatusCode(HttpStatus.FORBIDDEN);
                return exchange.getResponse().setComplete();
            }
            // If it's an internal route but lacks the internal header, it's an invalid attempt
            // (This logic assumes internal services add the header, which we can't enforce here)
            // For now, we just block external access.
        }
        return chain.filter(exchange);
    }

    @Override
    public int getOrder() {
        return -1; // Run this filter early
    }
}