package com.club.triathlon.config

import com.club.triathlon.security.CustomAccessDeniedHandler
import com.club.triathlon.security.CustomAuthenticationEntryPoint
import com.club.triathlon.security.JwtAuthenticationFilter
import com.club.triathlon.security.OAuth2AuthenticationSuccessHandler
import org.springframework.beans.factory.annotation.Value
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.http.ResponseCookie
import org.springframework.security.authentication.AuthenticationManager
import org.springframework.security.authentication.AuthenticationProvider
import org.springframework.security.authentication.dao.DaoAuthenticationProvider
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity
import org.springframework.security.config.annotation.web.builders.HttpSecurity
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity
import org.springframework.security.config.http.SessionCreationPolicy
import org.springframework.security.core.userdetails.UserDetailsService
import org.springframework.security.crypto.password.PasswordEncoder
import org.springframework.security.web.csrf.CookieCsrfTokenRepository
import org.springframework.security.web.SecurityFilterChain
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter
import org.springframework.web.cors.CorsConfiguration
import org.springframework.web.cors.CorsConfigurationSource
import org.springframework.web.cors.UrlBasedCorsConfigurationSource
import java.util.function.Consumer

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
class SecurityConfig(
    private val jwtAuthenticationFilter: JwtAuthenticationFilter,
    private val userDetailsService: UserDetailsService,
    private val customAccessDeniedHandler: CustomAccessDeniedHandler,
    private val customAuthenticationEntryPoint: CustomAuthenticationEntryPoint,
    private val oAuth2AuthenticationSuccessHandler: OAuth2AuthenticationSuccessHandler,
    @Value("\${app.cors.allowed-origins}") private val allowedOriginsProperty: String,
    @Value("\${app.use-secure-cookies:false}") private val useSecureCookies: Boolean,
    @Value("\${app.cookie.domain:}") private val cookieDomain: String
) {

    @Bean
    fun securityFilterChain(
        http: HttpSecurity,
        authenticationProvider: AuthenticationProvider,
        corsConfigurationSource: CorsConfigurationSource
    ): SecurityFilterChain {
        val csrfRepo = CookieCsrfTokenRepository.withHttpOnlyFalse().apply {
            // Keep CSRF cookie aligned with auth cookies to avoid “works for GET, fails for POST” in cross-origin dev.
            setCookiePath("/")
            setSecure(useSecureCookies)
            if (cookieDomain.isNotBlank()) {
                // Share CSRF cookie across subdomains (e.g., motiontimisoara.com + api.motiontimisoara.com)
                setCookieDomain(cookieDomain)
            }
            // Spring defaults to SameSite=Lax; when secure cookies are enabled we want SameSite=None
            // so the CSRF cookie is sent alongside our SameSite=None auth cookies.
            setCookieCustomizer(Consumer<ResponseCookie.ResponseCookieBuilder> { builder ->
                builder.sameSite(if (useSecureCookies) "None" else "Lax")
            })
        }

        http
            // CSRF is required because we use cookies for auth; allowlist only the public auth flows
            .csrf {
                it.csrfTokenRepository(csrfRepo)
                    .ignoringRequestMatchers(
                        "/api/auth/login",
                        "/api/auth/register-parent",
                        "/api/auth/register-coach",
                        "/api/auth/register-club",
                        "/api/auth/validate-club-code",
                        "/api/auth/forgot-password",
                        "/api/auth/reset-password",
                        "/api/auth/refresh",
                        "/api/auth/logout",
                        "/api/auth/csrf",
                        "/api/locations",
                        "/api/locations/*",
                        "/api/locations/*/track-usage",
                        "/api/admin/locations",
                        "/api/admin/locations/*",
                        "/api/admin/activities",
                        "/api/admin/activities/*",
                        "/api/admin/activities/*/status",
                        "/api/admin/activities/*/hero-photo",
                        "/api/admin/courses/*",
                        "/api/club/locations",
                        "/api/club/locations/*",
                        "/api/admin/clubs/*",
                        "/api/admin/clubs/*/sports",
                        "/api/admin/clubs/*/logo",
                        "/api/admin/users/*",
                        "/api/admin/users/*/children",
                        "/api/admin/users/*/children/*",
                        "/api/admin/users/*/children/*/photo"
                    )
            }
            .cors { it.configurationSource(corsConfigurationSource) }
            .sessionManagement { it.sessionCreationPolicy(SessionCreationPolicy.STATELESS) }
            .exceptionHandling {
                it.accessDeniedHandler(customAccessDeniedHandler)
                it.authenticationEntryPoint(customAuthenticationEntryPoint)
            }
            .oauth2Login { oauth ->
                oauth.successHandler(oAuth2AuthenticationSuccessHandler)
            }
            .authorizeHttpRequests {
                it.requestMatchers(
                    "/api/auth/login",
                    "/api/auth/register-parent",
                    "/api/auth/register-coach",
                    "/api/auth/register-club",
                    "/api/auth/validate-club-code",
                    "/api/auth/refresh",
                    "/api/auth/forgot-password",
                    "/api/auth/reset-password",
                    "/api/auth/logout"
                ).permitAll()  // Auth endpoints
                    .requestMatchers("/oauth2/**", "/login/oauth2/**").permitAll()
                    .requestMatchers("/v3/api-docs/**", "/swagger-ui/**", "/api/public/**").permitAll()
                    // Public location endpoints (search, cities, by-city)
                    .requestMatchers(
                        org.springframework.http.HttpMethod.GET,
                        "/api/locations/cities",
                        "/api/locations/search",
                        "/api/locations/by-city/**",
                        "/api/locations/similar"
                    ).permitAll()
                    .requestMatchers(org.springframework.http.HttpMethod.GET, "/api/locations/*").permitAll()
                    // Allow WebSocket/SockJS handshake without JWT; topics remain non-sensitive events only
                    .requestMatchers("/ws/**").permitAll()
                    // Allow Stripe webhooks (Stripe does not send our JWT)
                    .requestMatchers("/api/webhooks/stripe", "/api/webhooks/stripe/connect").permitAll()
                    .requestMatchers("/api/admin/coaches/*/photo").permitAll()  // Allow public access to coach photos
                    .requestMatchers(org.springframework.http.HttpMethod.OPTIONS, "/**").permitAll()  // Allow CORS preflight
                    .requestMatchers("/api/enrollments/*/purchase-sessions").hasAnyRole("ADMIN", "COACH", "PARENT", "CLUB")  // Session purchases accessible by admin/coach/parent/club
                    .requestMatchers("/api/enrollments/**", "/api/parent/**").hasRole("PARENT")
                    .requestMatchers("/api/admin/attendance/**").hasAnyRole("ADMIN", "COACH")  // Allow coaches to access attendance endpoints
                    .requestMatchers("/api/admin/**").hasRole("ADMIN")
                    .requestMatchers("/api/club/**").hasRole("CLUB")
                    .requestMatchers("/api/coach/**").hasAnyRole("COACH", "ADMIN")
                    .requestMatchers("/error").permitAll()
                    .anyRequest().authenticated()
            }
            .authenticationProvider(authenticationProvider)
            .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter::class.java)

        return http.build()
    }

    @Bean
    fun authenticationProvider(passwordEncoder: PasswordEncoder): AuthenticationProvider {
        val provider = DaoAuthenticationProvider()
        provider.setUserDetailsService(userDetailsService)
        provider.setPasswordEncoder(passwordEncoder)
        return provider
    }

    @Bean
    fun authenticationManager(configuration: AuthenticationConfiguration): AuthenticationManager =
        configuration.authenticationManager

    @Bean
    fun corsConfigurationSource(): CorsConfigurationSource {
        val configuration = CorsConfiguration()
        val origins = allowedOriginsProperty.split(",")
            .map { it.trim() }
            .filter { it.isNotEmpty() }
        
        // When allowCredentials is true, we cannot use "*" for origins
        // Provide a default origin list if none specified
        // Use allowedOriginPatterns to support port wildcards (e.g., for browser preview)
        configuration.allowedOriginPatterns = if (origins.isEmpty()) {
            listOf("http://localhost:*", "http://127.0.0.1:*")
        } else {
            origins + listOf("http://127.0.0.1:*")  // Add 127.0.0.1 with any port for browser preview
        }
        
        configuration.allowedMethods = listOf("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS")
        configuration.allowedHeaders = listOf("*")
        configuration.allowCredentials = true
        configuration.exposedHeaders = listOf("Authorization", "Content-Type")
        configuration.maxAge = 3600L // Cache preflight response for 1 hour
        
        val source = UrlBasedCorsConfigurationSource()
        source.registerCorsConfiguration("/**", configuration)
        return source
    }
}



