package pse.trippy.apigateway.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.reactive.EnableWebFluxSecurity;
import org.springframework.security.config.web.server.ServerHttpSecurity;
import org.springframework.security.web.server.SecurityWebFilterChain;

@Configuration
@EnableWebFluxSecurity
public class SecurityConfig {

    private static final String[] PUBLIC_ROUTES = {
            "/auth/**", "/.well-known/**", "/actuator/health/**"
    };

    @Bean
    public SecurityWebFilterChain springSecurityFilterChain(ServerHttpSecurity http) {
        http
                .csrf(ServerHttpSecurity.CsrfSpec::disable)
                .authorizeExchange(
                        exchanges ->
                                exchanges
                                        .pathMatchers(PUBLIC_ROUTES)
                                        .permitAll()
                                        .pathMatchers(HttpMethod.GET, "/trips/discover")
                                        .permitAll()
                                        // All other requests must be authenticated
                                        .anyExchange()
                                        .authenticated());

        return http.build();
    }
}
