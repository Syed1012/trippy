package pse.trippy.apigateway.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.reactive.CorsWebFilter;
import org.springframework.web.cors.reactive.UrlBasedCorsConfigurationSource;

import org.springframework.beans.factory.annotation.Value;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;

/**
 * Configuration for Cross-Origin Resource Sharing (CORS) in the API Gateway.
 * This configuration allows requests from the frontend (localhost:3000) with specific headers.
 */
@Configuration
public class CorsConfig {

    @Bean
    public CorsWebFilter corsWebFilter(@Value("${APP_BASE_URL:http://localhost:3000}") String appBaseUrl) {
        CorsConfiguration corsConfig = new CorsConfiguration();
        
        List<String> allowedOrigins = new ArrayList<>();
        allowedOrigins.add("http://localhost:3000");
        allowedOrigins.add("http://127.0.0.1:3000");
        if (appBaseUrl != null && !appBaseUrl.isBlank()) {
            String trimmed = appBaseUrl.replaceAll("/+$", "");
            if (!allowedOrigins.contains(trimmed)) {
                allowedOrigins.add(trimmed);
            }
        }
        corsConfig.setAllowedOrigins(allowedOrigins);
        
        // Allow all standard HTTP methods
        corsConfig.setAllowedMethods(Arrays.asList(
                HttpMethod.GET.name(),
                HttpMethod.POST.name(),
                HttpMethod.PUT.name(),
                HttpMethod.DELETE.name(),
                HttpMethod.PATCH.name(),
                HttpMethod.OPTIONS.name()
        ));
        
        // Allow specific headers
        corsConfig.setAllowedHeaders(Arrays.asList(
                "Authorization",
                "Content-Type",
                "X-Correlation-ID"
        ));
        
        // Expose X-Correlation-ID header in response
        corsConfig.setExposedHeaders(Collections.singletonList("X-Correlation-ID"));
        
        // Allow credentials
        corsConfig.setAllowCredentials(true);
        
        // Cache preflight response for 1 hour
        corsConfig.setMaxAge(3600L);
        
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", corsConfig);
        
        return new CorsWebFilter(source);
    }
}
