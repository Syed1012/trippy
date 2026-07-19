package pse.trippy.apigateway.filter;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.core.Ordered;
import org.springframework.http.HttpHeaders;
import org.springframework.security.core.context.ReactiveSecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

@Component
public class UserPlanHeaderFilter implements GlobalFilter, Ordered {

    private final WebClient.Builder webClientBuilder;
    private final String userServiceUrl;

    public UserPlanHeaderFilter(WebClient.Builder webClientBuilder,
                                @Value("${trippy.gateway.downstream-services.user-service}") String userServiceUrl) {
        this.webClientBuilder = webClientBuilder;
        this.userServiceUrl = userServiceUrl;
    }

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        return ReactiveSecurityContextHolder.getContext()
                .flatMap(securityContext -> {
                    // Only act if a user is authenticated
                    if (securityContext.getAuthentication() != null && securityContext.getAuthentication().isAuthenticated()) {
                        String userId = securityContext.getAuthentication().getName(); // Assuming principal name is user ID
                        return fetchUserPlan(userId)
                                .flatMap(plan -> {
                                    exchange.getRequest().mutate().header("X-User-Plan", plan).build();
                                    return chain.filter(exchange);
                                });
                    }
                    return chain.filter(exchange);
                })
                .switchIfEmpty(chain.filter(exchange)); // Continue if no security context
    }

    private Mono<String> fetchUserPlan(String userId) {
        return webClientBuilder.build().get()
                .uri(userServiceUrl + "/users/" + userId + "/plan")
                .header(HttpHeaders.ACCEPT, "application/json")
                .retrieve()
                .bodyToMono(String.class)
                .onErrorReturn("FREE"); // Fallback to FREE plan on error
    }

    @Override
    public int getOrder() {
        return 10; // Run after security filters
    }
}