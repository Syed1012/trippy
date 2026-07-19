package pse.trippy.apigateway.filter;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.core.Ordered;
import org.springframework.data.redis.core.ReactiveStringRedisTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.util.AntPathMatcher;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

import java.net.InetSocketAddress;
import java.time.Duration;
import java.util.List;

@Component
@Slf4j
@RequiredArgsConstructor
public class GatewayRateLimitFilter implements GlobalFilter, Ordered {

    private static final int ORDER = 0;
    private static final long WINDOW_SECONDS = 60L;
    private static final AntPathMatcher PATH_MATCHER = new AntPathMatcher();

    private static final String RATE_LIMIT_LIMIT_HEADER = "X-RateLimit-Limit";
    private static final String RATE_LIMIT_REMAINING_HEADER = "X-RateLimit-Remaining";
    private static final String RATE_LIMIT_RESET_HEADER = "X-RateLimit-Reset";

    private static final List<RateLimitRule> RULES = List.of(
            new RateLimitRule("/auth/**", "auth", 10),
            new RateLimitRule("/trips/{tripId}/chat/**", "trips-chat", 200),
            new RateLimitRule("/trips/discover", "trips-discover", 30),
            new RateLimitRule("/trips/**", "trips", 100),
            new RateLimitRule("/ai/**", "ai", 20),
            new RateLimitRule("/payments/**", "payments", 50),
            new RateLimitRule("/notifications/**", "notifications", 100),
            new RateLimitRule("/users/**", "users", 100),
            new RateLimitRule("/admin/**", "admin", 100)
    );

    private final ReactiveStringRedisTemplate redisTemplate;

    @Override
    public int getOrder() {
        return ORDER;
    }

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        String path = exchange.getRequest().getURI().getPath();

        if (isRateLimitBypassed(path)) {
            return chain.filter(exchange);
        }

        RateLimitRule rule = findRule(path);
        if (rule == null) {
            return chain.filter(exchange);
        }

        String identity = resolveIdentity(exchange);
        String key = "ratelimit:" + identity + ":" + rule.key();

        return redisTemplate.opsForValue().increment(key)
                .flatMap(count -> {
                    if (count != null && count == 1L) {
                        return redisTemplate.expire(key, Duration.ofSeconds(WINDOW_SECONDS))
                                .thenReturn(count);
                    }
                    return Mono.just(count);
                })
                .flatMap(count -> {
                    long remaining = Math.max(0L, rule.limit() - count);
                    setRateLimitHeaders(exchange, rule.limit(), remaining, WINDOW_SECONDS);

                    if (count > rule.limit()) {
                        log.debug("Rate limit exceeded for key {} on path {} (count={}, limit={})",
                                key, path, count, rule.limit());
                        exchange.getResponse().setStatusCode(HttpStatus.TOO_MANY_REQUESTS);
                        return exchange.getResponse().setComplete();
                    }

                    return chain.filter(exchange);
                });
    }

    private void setRateLimitHeaders(ServerWebExchange exchange, long limit, long remaining, long resetSeconds) {
        exchange.getResponse().getHeaders().set(RATE_LIMIT_LIMIT_HEADER, Long.toString(limit));
        exchange.getResponse().getHeaders().set(RATE_LIMIT_REMAINING_HEADER, Long.toString(remaining));
        exchange.getResponse().getHeaders().set(RATE_LIMIT_RESET_HEADER, Long.toString(resetSeconds));
    }

    private boolean isRateLimitBypassed(String path) {
        return path.equals("/health")
                || path.equals("/actuator/health")
                || path.startsWith("/actuator/")
                || path.startsWith("/.well-known/")
                || path.startsWith("/ws/");
    }

    private RateLimitRule findRule(String path) {
        return RULES.stream()
                .filter(rule -> PATH_MATCHER.match(rule.pattern(), path))
                .findFirst()
                .orElse(null);
    }

    private String resolveIdentity(ServerWebExchange exchange) {
        String userId = exchange.getRequest().getHeaders().getFirst("X-User-Id");
        if (userId != null && !userId.isBlank()) {
            return "user:" + userId;
        }

        InetSocketAddress remoteAddress = exchange.getRequest().getRemoteAddress();
        if (remoteAddress != null && remoteAddress.getAddress() != null) {
            return "ip:" + remoteAddress.getAddress().getHostAddress();
        }

        return "ip:unknown";
    }

    private record RateLimitRule(String pattern, String key, long limit) {
    }
}