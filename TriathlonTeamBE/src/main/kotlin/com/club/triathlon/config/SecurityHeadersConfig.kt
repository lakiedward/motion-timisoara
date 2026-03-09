package com.club.triathlon.config

import jakarta.servlet.Filter
import jakarta.servlet.FilterChain
import jakarta.servlet.ServletRequest
import jakarta.servlet.ServletResponse
import jakarta.servlet.http.HttpServletResponse
import org.springframework.beans.factory.annotation.Value
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.core.Ordered
import org.springframework.core.annotation.Order

/**
 * Configurare Security Headers pentru protecție îmbunătățită
 *
 * Headers implementate:
 * - Content-Security-Policy: Previne XSS și alte atacuri de injectare
 * - X-Frame-Options: Previne clickjacking
 * - X-Content-Type-Options: Previne MIME sniffing
 * - X-XSS-Protection: Activează protecția XSS a browser-ului
 * - Strict-Transport-Security: Forțează HTTPS (doar în producție)
 * - Referrer-Policy: Controlează informațiile trimise în Referrer header
 * - Permissions-Policy: Controlează access la feature-uri browser
 */
@Configuration
class SecurityHeadersConfig(
    @Value("\${app.use-secure-cookies:false}") private val useSecureCookies: Boolean
) {

    @Bean
    @Order(Ordered.HIGHEST_PRECEDENCE)
    fun securityHeadersFilter(): Filter {
        return Filter { request, response, chain ->
            val httpResponse = response as HttpServletResponse

            // Content Security Policy
            // Permite resurse de la origine proprie + CDN-uri de încredere
            // upgrade-insecure-requests este activat doar în producție (când SSL este configurat)
            // 'unsafe-inline' necesar pentru Stripe.js și Google fraud detection
            val cspPolicy = buildString {
                append("default-src 'self'; ")
                append("script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' https://js.stripe.com https://www.google.com https://www.gstatic.com https://unpkg.com https://accounts.google.com; ")
                append("style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://unpkg.com; ")
                append("img-src 'self' data: https: blob:; ")
                append("font-src 'self' data: https://fonts.gstatic.com; ")
                append("connect-src 'self' https://api.stripe.com https://m.stripe.com https://js.stripe.com https://www.google.com; ")
                append("frame-src 'self' https://js.stripe.com https://*.google.com https://accounts.google.com; ")
                append("object-src 'none'; ")
                append("base-uri 'self'; ")
                append("form-action 'self'; ")
                append("frame-ancestors 'none';")
                // Only require HTTPS upgrade in production
                if (useSecureCookies) {
                    append(" upgrade-insecure-requests;")
                }
            }

            httpResponse.setHeader("Content-Security-Policy", cspPolicy)
            
            // Previne încărcarea site-ului în iframe (protecție clickjacking)
            httpResponse.setHeader("X-Frame-Options", "DENY")
            
            // Previne MIME sniffing
            httpResponse.setHeader("X-Content-Type-Options", "nosniff")
            
            // Activează XSS protection în browser
            httpResponse.setHeader("X-XSS-Protection", "1; mode=block")

            // Strict Transport Security (HSTS)
            // Forțează HTTPS pentru 1 an, inclusiv subdomenii
            // Activat doar în producție (când SSL este configurat)
            if (useSecureCookies) {
                httpResponse.setHeader(
                    "Strict-Transport-Security",
                    "max-age=31536000; includeSubDomains; preload"
                )
            }
            
            // Controlează ce informații sunt trimise în Referrer header
            httpResponse.setHeader("Referrer-Policy", "strict-origin-when-cross-origin")
            
            // Permissions Policy (fostul Feature-Policy)
            // Dezactivează feature-uri sensibile
            httpResponse.setHeader(
                "Permissions-Policy",
                "geolocation=(), microphone=(), camera=(), payment=(self)"
            )
            
            chain.doFilter(request, response)
        }
    }
}





