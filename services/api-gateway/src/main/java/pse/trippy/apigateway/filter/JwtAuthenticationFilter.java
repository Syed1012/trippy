package pse.trippy.apigateway.filter;

import com.nimbusds.jose.JOSEException;
import com.nimbusds.jose.crypto.RSASSAVerifier;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.core.Ordered;
import org.springframework.data.redis.core.ReactiveStringRedisTemplate;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.util.AntPathMatcher;
import org.springframework.web.server.ServerWebExchange;
import pse.trippy.apigateway.service.JwksClient;
import reactor.core.publisher.Mono;

import java.security.interfaces.RSAPublicKey;
import java.text.ParseException;
import java.util.Date;
import java.util.List;

/**
 * Global gateway filter — validates JWT Bearer tokens on all protected routes.
 * Public routes (/auth/**, /.well-known/**, /health) bypass validation.
 * Validated tokens have user claims injected as X-User-* headers for downstream services.
 * Runs at order -1 (before all other global filters).
 */

@Component
@Slf4j
@RequiredArgsConstructor
public class JwtAuthenticationFilter implements GlobalFilter, Ordered {

    private static final int FILTER_ORDER = -1;
    private static final String BEARER_PREFIX = "Bearer ";
    private static final AntPathMatcher PATH_MATCHER = new AntPathMatcher();

    private static final String TOKEN_BLACKLIST_PREFIX = "blacklist:token:";
    private static final String USER_BLACKLIST_PREFIX  = "blacklist:user:";
    private static final List<String> PUBLIC_PATHS = List.of(
            "/auth/**",
            "/.well-known/**",
            "/health",
            "/actuator/health",
            "/trips/shared/**",
            "/payments/webhook",
            "/ws/**"
    );

    private static final List<String> ADMIN_ONLY_PATHS = List.of(
            "/actuator/metrics",
            "/actuator/metrics/**",
            "/actuator/gateway",
            "/actuator/gateway/**",
            "/services/*/actuator/**"
    );

    private final JwksClient jwksClient;
    private final ReactiveStringRedisTemplate redisTemplate;

    @Override
    public int getOrder() {
        return FILTER_ORDER;
    }

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        String path = exchange.getRequest().getURI().getPath();

        if (isPublicPath(path)) {
            return chain.filter(exchange);
        }

        String authHeader = exchange.getRequest().getHeaders().getFirst(HttpHeaders.AUTHORIZATION);
        if (authHeader == null || !authHeader.startsWith(BEARER_PREFIX)) {
            return unauthorized(exchange);
        }

        String token = authHeader.substring(BEARER_PREFIX.length());

        JWTClaimsSet claims;
        try {
            claims = validateToken(token);
        } catch (ParseException | JOSEException ex) {
            log.debug("JWT validation error: {}", ex.getMessage());
            return unauthorized(exchange);
        }

        if (claims == null) {
            return unauthorized(exchange);
        }

        String jti    = claims.getJWTID();
        String userId = claims.getSubject();
        String role   = getClaimAsString(claims, "role");
        String email  = getClaimAsString(claims, "email");
        String plan   = getClaimAsString(claims, "plan");

        if (userId == null || role == null || email == null || plan == null) {
            log.debug("JWT missing required claims (sub, role, email, plan)");
            return unauthorized(exchange);
        }

        return isBlacklisted(jti, userId)
                .flatMap(blacklisted -> {
                    if (Boolean.TRUE.equals(blacklisted)) {
                        log.debug("Blacklisted token: jti={}", jti);
                        return unauthorized(exchange);
                    }

                    if (isAdminOnlyPath(path) && !"ADMIN".equalsIgnoreCase(role)) {
                        log.debug("Non-admin user {} tried to access admin path: {}", userId, path);
                        return forbidden(exchange);
                    }

                    ServerWebExchange mutated = exchange.mutate()
                            .request(exchange.getRequest().mutate()
                                    .header("X-User-Id",    userId)
                                    .header("X-User-Role",  role)
                                    .header("X-User-Email", email)
                                    .header("X-User-Plan",  plan)
                                    .headers(h -> h.remove(HttpHeaders.AUTHORIZATION))
                                    .build())
                            .build();

                    return chain.filter(mutated);
                });
    }

    private JWTClaimsSet validateToken(String token) throws ParseException, JOSEException {
        RSAPublicKey key = jwksClient.getPublicKey();
        if (key == null) {
            log.warn("No JWKS public key available — rejecting token");
            return null;
        }

        SignedJWT jwt   = SignedJWT.parse(token);
        boolean  valid  = jwt.verify(new RSASSAVerifier(key));

        if (!valid) {
            RSAPublicKey refreshed = jwksClient.refreshAndGet();
            if (refreshed != null) {
                jwt   = SignedJWT.parse(token);
                valid = jwt.verify(new RSASSAVerifier(refreshed));
            }
        }

        if (!valid) {
            return null;
        }

        JWTClaimsSet claims = jwt.getJWTClaimsSet();
        Date exp = claims.getExpirationTime();
        if (exp == null || exp.before(new Date())) {
            log.debug("JWT expired at {}", exp);
            return null;
        }

        return claims;
    }

    private boolean isPublicPath(String path) {
        return PUBLIC_PATHS.stream().anyMatch(p -> PATH_MATCHER.match(p, path));
    }

    private boolean isAdminOnlyPath(String path) {
        return ADMIN_ONLY_PATHS.stream().anyMatch(p -> PATH_MATCHER.match(p, path));
    }

    private Mono<Boolean> isBlacklisted(String jti, String userId) {
        return redisTemplate.hasKey(TOKEN_BLACKLIST_PREFIX + jti)
                .flatMap(tokenBlacklisted -> {
                    if (Boolean.TRUE.equals(tokenBlacklisted)) {
                        return Mono.just(true);
                    }
                    if (userId != null) {
                        return redisTemplate.hasKey(USER_BLACKLIST_PREFIX + userId);
                    }
                    return Mono.just(false);
                })
                .onErrorResume(ex -> {
                    log.warn("Redis blacklist check failed, allowing request: {}", ex.getMessage());
                    return Mono.just(false);
                });
    }

    private Mono<Void> unauthorized(ServerWebExchange exchange) {
        exchange.getResponse().setStatusCode(HttpStatus.UNAUTHORIZED);
        return exchange.getResponse().setComplete();
    }

    private Mono<Void> forbidden(ServerWebExchange exchange) {
        exchange.getResponse().setStatusCode(HttpStatus.FORBIDDEN);
        return exchange.getResponse().setComplete();
    }

    private String getClaimAsString(JWTClaimsSet claims, String name) {
        Object val = claims.getClaim(name);
        return val != null ? val.toString() : null;
    }
}
