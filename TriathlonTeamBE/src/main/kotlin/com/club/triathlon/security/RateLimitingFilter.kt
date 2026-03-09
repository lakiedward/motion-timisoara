package com.club.triathlon.security

import jakarta.servlet.Filter
import jakarta.servlet.FilterChain
import jakarta.servlet.ServletRequest
import jakarta.servlet.ServletResponse
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.http.HttpStatus
import org.springframework.stereotype.Component
import com.club.triathlon.util.RequestUtils
import java.time.Instant
import java.util.concurrent.ConcurrentHashMap

/**
 * Rate Limiting Filter for protection against brute force and abuse
 * 
 * Implemented limits:
 * - Auth endpoints: 5 requests / 15 minutes / IP
 * - Public endpoints: 60 requests / minute / IP
 * - Contact form: 3 requests / 10 minutes / IP
 */
@Component
class RateLimitingFilter : Filter {

    private val logger = LoggerFactory.getLogger(RateLimitingFilter::class.java)
    
    // Store: IP -> List of timestamps
    private val authAttempts = ConcurrentHashMap<String, MutableList<Instant>>()
    private val publicAttempts = ConcurrentHashMap<String, MutableList<Instant>>()
    private val contactAttempts = ConcurrentHashMap<String, MutableList<Instant>>()
    private val dsarAttempts = ConcurrentHashMap<String, MutableList<Instant>>()
    
    // Limits configuration
    @Value("\${app.security.rate-limit.auth-max-attempts:5}")
    private var authMaxAttempts: Int = 5

    @Value("\${app.security.rate-limit.auth-window-seconds:900}")
    private var authWindowSeconds: Long = 900 // 15 minutes
    
    @Value("\${app.security.rate-limit.public-max-attempts:60}")
    private var publicMaxAttempts: Int = 60

    @Value("\${app.security.rate-limit.public-window-seconds:60}")
    private var publicWindowSeconds: Long = 60 // 1 minute
    
    @Value("\${app.security.rate-limit.contact-max-attempts:3}")
    private var contactMaxAttempts: Int = 3

    @Value("\${app.security.rate-limit.contact-window-seconds:600}")
    private var contactWindowSeconds: Long = 600 // 10 minutes

    @Value("\${app.security.rate-limit.dsar-max-attempts:5}")
    private var dsarMaxAttempts: Int = 5

    @Value("\${app.security.rate-limit.dsar-window-seconds:3600}")
    private var dsarWindowSeconds: Long = 3600 // 1 hour

    @Value("\${app.security.trusted-proxies:}")
    private var trustedProxiesStr: String = ""

    private val trustedProxies: List<String> by lazy {
        trustedProxiesStr.split(",").map { it.trim() }.filter { it.isNotBlank() }
    }

    override fun doFilter(request: ServletRequest, response: ServletResponse, chain: FilterChain) {
        val httpRequest = request as HttpServletRequest
        val httpResponse = response as HttpServletResponse
        val clientIp = getClientIP(httpRequest)
        val requestUri = httpRequest.requestURI
        
        // Check rate limits based on endpoint
        val limitExceeded = when {
            isDsarEndpoint(requestUri) -> {
                checkRateLimit(clientIp, dsarAttempts, dsarMaxAttempts, dsarWindowSeconds, "DSAR")
            }
            isAuthEndpoint(requestUri) -> {
                checkRateLimit(clientIp, authAttempts, authMaxAttempts, authWindowSeconds, "AUTH")
            }
            isContactEndpoint(requestUri) -> {
                checkRateLimit(clientIp, contactAttempts, contactMaxAttempts, contactWindowSeconds, "CONTACT")
            }
            isPublicEndpoint(requestUri) -> {
                checkRateLimit(clientIp, publicAttempts, publicMaxAttempts, publicWindowSeconds, "PUBLIC")
            }
            else -> false // No rate limit for authenticated endpoints (JWT already validated)
        }
        
        if (limitExceeded) {
            logger.warn("RATE_LIMIT: Too many requests from IP: {} to {}", clientIp, requestUri)
            httpResponse.status = HttpStatus.TOO_MANY_REQUESTS.value()
            httpResponse.contentType = "application/json"
            httpResponse.writer.write("""{"error":"Too many requests. Please try again later."}""")
            return
        }
        
        chain.doFilter(request, response)
    }
    
    private fun checkRateLimit(
        clientIp: String,
        attempts: ConcurrentHashMap<String, MutableList<Instant>>,
        maxAttempts: Int,
        windowSeconds: Long,
        category: String
    ): Boolean {
        val now = Instant.now()
        val cutoff = now.minusSeconds(windowSeconds)
        
        // Get or create attempts list for this IP
        val ipAttempts = attempts.computeIfAbsent(clientIp) { mutableListOf() }
        
        // Synchronized access to modify the list
        synchronized(ipAttempts) {
            // Remove old attempts outside the time window
            ipAttempts.removeIf { it.isBefore(cutoff) }
            
            // Check if limit exceeded
            if (ipAttempts.size >= maxAttempts) {
                logger.debug("{}: Rate limit exceeded for IP: {} ({}/{})", 
                    category, clientIp, ipAttempts.size, maxAttempts)
                return true
            }
            
            // Add current attempt
            ipAttempts.add(now)
            logger.trace("{}: Request allowed for IP: {} ({}/{})", 
                category, clientIp, ipAttempts.size, maxAttempts)
        }
        
        // Cleanup old IPs periodically (simple strategy)
        if (Math.random() < 0.01) { // 1% chance per request
            cleanupOldEntries(attempts, windowSeconds)
        }
        
        return false
    }
    
    private fun cleanupOldEntries(
        attempts: ConcurrentHashMap<String, MutableList<Instant>>,
        windowSeconds: Long
    ) {
        val cutoff = Instant.now().minusSeconds(windowSeconds * 2) // Keep 2x window for safety
        val ipsToRemove = mutableListOf<String>()
        
        attempts.forEach { (ip, timestamps) ->
            synchronized(timestamps) {
                timestamps.removeIf { it.isBefore(cutoff) }
                if (timestamps.isEmpty()) {
                    ipsToRemove.add(ip)
                }
            }
        }
        
        ipsToRemove.forEach { attempts.remove(it) }
        if (ipsToRemove.isNotEmpty()) {
            logger.debug("Cleaned up {} IP entries from rate limiting cache", ipsToRemove.size)
        }
    }
    
    private fun isAuthEndpoint(uri: String): Boolean {
        return uri == "/api/auth/login" ||
                uri == "/api/auth/register-parent" ||
                uri == "/api/auth/register-coach" ||
                uri == "/api/auth/register-club" ||
                uri == "/api/auth/refresh" ||
                uri == "/api/auth/forgot-password" ||
                uri == "/api/auth/reset-password" ||
                uri == "/api/auth/validate-club-code" ||
                uri == "/api/auth/csrf"
    }
    
    private fun isContactEndpoint(uri: String): Boolean {
        return uri == "/api/public/contact"
    }
    
    private fun isPublicEndpoint(uri: String): Boolean {
        return uri.startsWith("/api/public/") || uri.startsWith("/api/webhooks/")
    }

    private fun isDsarEndpoint(uri: String): Boolean {
        return uri == "/api/dsar/submit"
    }
    
    private fun getClientIP(request: HttpServletRequest): String {
        return RequestUtils.extractClientIp(request, trustedProxies)
    }
}
