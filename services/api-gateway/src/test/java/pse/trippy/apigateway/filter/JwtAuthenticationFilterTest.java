package pse.trippy.apigateway.filter;

import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.JWSHeader;
import com.nimbusds.jose.crypto.RSASSASigner;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.data.redis.core.ReactiveStringRedisTemplate;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.mock.http.server.reactive.MockServerHttpRequest;
import org.springframework.mock.web.server.MockServerWebExchange;
import org.springframework.web.server.ServerWebExchange;
import pse.trippy.apigateway.service.JwksClient;
import reactor.core.publisher.Mono;

import static org.mockito.ArgumentMatchers.anyString;

import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.interfaces.RSAPrivateKey;
import java.security.interfaces.RSAPublicKey;
import java.time.Instant;
import java.util.Date;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Unit tests for {@link JwtAuthenticationFilter}.
 * Covers valid/invalid/expired tokens and public route passthrough.
 */
@ExtendWith(MockitoExtension.class)
class JwtAuthenticationFilterTest {

    @Mock
    private JwksClient jwksClient;

    @Mock
    private GatewayFilterChain chain;

    @Mock
    private ReactiveStringRedisTemplate redisTemplate;

    private JwtAuthenticationFilter filter;
    private RSAPublicKey publicKey;
    private RSAPrivateKey privateKey;

    @BeforeEach
    void setUp() throws Exception {
        filter = new JwtAuthenticationFilter(jwksClient, redisTemplate);

        KeyPairGenerator generator = KeyPairGenerator.getInstance("RSA");
        generator.initialize(2048);
        KeyPair keyPair = generator.generateKeyPair();
        publicKey = (RSAPublicKey) keyPair.getPublic();
        privateKey = (RSAPrivateKey) keyPair.getPrivate();
    }

    @Test
    void filter_validJwt_injectsHeadersAndStripsAuthorization() throws Exception {
        String token = buildToken(Instant.now().plusSeconds(300), privateKey);
        when(jwksClient.getPublicKey()).thenReturn(publicKey);
        when(redisTemplate.hasKey(anyString())).thenReturn(Mono.just(false));

        MockServerHttpRequest request = MockServerHttpRequest.get("/trips/1")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + token)
                .build();
        MockServerWebExchange exchange = MockServerWebExchange.from(request);

        ArgumentCaptor<ServerWebExchange> captor = ArgumentCaptor.forClass(ServerWebExchange.class);
        when(chain.filter(captor.capture())).thenReturn(Mono.empty());

        filter.filter(exchange, chain).block();

        ServerWebExchange mutated = captor.getValue();
        assertThat(mutated.getRequest().getHeaders().getFirst("X-User-Id")).isEqualTo("user-uuid-123");
        assertThat(mutated.getRequest().getHeaders().getFirst("X-User-Role")).isEqualTo("USER");
        assertThat(mutated.getRequest().getHeaders().getFirst("X-User-Email")).isEqualTo("user@example.com");
        assertThat(mutated.getRequest().getHeaders().getFirst("X-User-Plan")).isEqualTo("PREMIUM");
        assertThat(mutated.getRequest().getHeaders().getFirst("X-User-DisplayName")).isEqualTo("Test User");
        assertThat(mutated.getRequest().getHeaders().containsKey(HttpHeaders.AUTHORIZATION)).isFalse();
    }

    @Test
    void filter_expiredJwt_returns401() throws Exception {
        String token = buildToken(Instant.now().minusSeconds(60), privateKey);
        when(jwksClient.getPublicKey()).thenReturn(publicKey);

        MockServerHttpRequest request = MockServerHttpRequest.get("/trips/1")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + token)
                .build();
        MockServerWebExchange exchange = MockServerWebExchange.from(request);

        filter.filter(exchange, chain).block();

        assertThat(exchange.getResponse().getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        verify(chain, never()).filter(any());
    }

    @Test
    void filter_invalidSignature_returns401() throws Exception {
        KeyPairGenerator gen = KeyPairGenerator.getInstance("RSA");
        gen.initialize(2048);
        RSAPrivateKey otherPrivateKey = (RSAPrivateKey) gen.generateKeyPair().getPrivate();
        String token = buildToken(Instant.now().plusSeconds(300), otherPrivateKey);

        when(jwksClient.getPublicKey()).thenReturn(publicKey);
        when(jwksClient.refreshAndGet()).thenReturn(publicKey);

        MockServerHttpRequest request = MockServerHttpRequest.get("/trips/1")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + token)
                .build();
        MockServerWebExchange exchange = MockServerWebExchange.from(request);

        filter.filter(exchange, chain).block();

        assertThat(exchange.getResponse().getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        verify(chain, never()).filter(any());
    }

    @Test
    void filter_noAuthHeader_returns401() {
        MockServerHttpRequest request = MockServerHttpRequest.get("/trips/1").build();
        MockServerWebExchange exchange = MockServerWebExchange.from(request);

        filter.filter(exchange, chain).block();

        assertThat(exchange.getResponse().getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        verify(chain, never()).filter(any());
    }

    @Test
    void filter_publicTripsWithoutAuth_passesThrough() {
        MockServerHttpRequest request = MockServerHttpRequest.get("/trips/public").build();
        MockServerWebExchange exchange = MockServerWebExchange.from(request);
        when(chain.filter(exchange)).thenReturn(Mono.empty());

        filter.filter(exchange, chain).block();

        verify(chain).filter(exchange);
    }

    @Test
    void filter_publicTripsWithJwt_injectsUserHeaders() throws Exception {
        String token = buildToken(Instant.now().plusSeconds(300), privateKey);
        when(jwksClient.getPublicKey()).thenReturn(publicKey);
        when(redisTemplate.hasKey(anyString())).thenReturn(Mono.just(false));

        MockServerHttpRequest request = MockServerHttpRequest.get("/trips/public")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + token)
                .build();
        MockServerWebExchange exchange = MockServerWebExchange.from(request);
        ArgumentCaptor<ServerWebExchange> captor = ArgumentCaptor.forClass(ServerWebExchange.class);
        when(chain.filter(captor.capture())).thenReturn(Mono.empty());

        filter.filter(exchange, chain).block();

        assertThat(captor.getValue().getRequest().getHeaders().getFirst("X-User-Id"))
                .isEqualTo("user-uuid-123");
    }

    @Test
    void filter_malformedToken_returns401() {
        when(jwksClient.getPublicKey()).thenReturn(publicKey);

        MockServerHttpRequest request = MockServerHttpRequest.get("/trips/1")
                .header(HttpHeaders.AUTHORIZATION, "Bearer not.a.valid.jwt")
                .build();
        MockServerWebExchange exchange = MockServerWebExchange.from(request);

        filter.filter(exchange, chain).block();

        assertThat(exchange.getResponse().getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        verify(chain, never()).filter(any());
    }

    @Test
    void filter_authPublicRoute_passesThroughWithoutAuth() {
        MockServerHttpRequest request = MockServerHttpRequest.get("/auth/login").build();
        MockServerWebExchange exchange = MockServerWebExchange.from(request);
        when(chain.filter(exchange)).thenReturn(Mono.empty());

        filter.filter(exchange, chain).block();

        verify(chain).filter(exchange);
    }

    @Test
    void filter_wellKnownRoute_passesThroughWithoutAuth() {
        MockServerHttpRequest request = MockServerHttpRequest.get("/.well-known/jwks.json").build();
        MockServerWebExchange exchange = MockServerWebExchange.from(request);
        when(chain.filter(exchange)).thenReturn(Mono.empty());

        filter.filter(exchange, chain).block();

        verify(chain).filter(exchange);
    }

    @Test
    void filter_healthRoute_passesThroughWithoutAuth() {
        MockServerHttpRequest request = MockServerHttpRequest.get("/health").build();
        MockServerWebExchange exchange = MockServerWebExchange.from(request);
        when(chain.filter(exchange)).thenReturn(Mono.empty());

        filter.filter(exchange, chain).block();

        verify(chain).filter(exchange);
    }

    // --- helper ---

    private String buildToken(Instant expiry, RSAPrivateKey signingKey) throws Exception {
        JWTClaimsSet claims = new JWTClaimsSet.Builder()
                .subject("user-uuid-123")
                .claim("email", "user@example.com")
                .claim("displayName", "Test User")
                .claim("role", "USER")
                .claim("plan", "PREMIUM")
                .expirationTime(Date.from(expiry))
                .build();

        JWSHeader header = new JWSHeader(JWSAlgorithm.RS256);
        SignedJWT jwt = new SignedJWT(header, claims);
        jwt.sign(new RSASSASigner(signingKey));
        return jwt.serialize();
    }
}
