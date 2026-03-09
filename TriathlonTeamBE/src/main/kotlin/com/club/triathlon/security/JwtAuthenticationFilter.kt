package com.club.triathlon.security

import jakarta.servlet.FilterChain
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import org.slf4j.LoggerFactory
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken
import org.springframework.security.core.context.SecurityContextHolder
import org.springframework.security.core.userdetails.UserDetailsService
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource
import org.springframework.stereotype.Component
import org.springframework.util.StringUtils
import org.springframework.web.filter.OncePerRequestFilter

@Component
class JwtAuthenticationFilter(
    private val jwtService: JwtService,
    private val userDetailsService: UserDetailsService
) : OncePerRequestFilter() {

    private val logger = LoggerFactory.getLogger(JwtAuthenticationFilter::class.java)

    override fun doFilterInternal(
        request: HttpServletRequest,
        response: HttpServletResponse,
        filterChain: FilterChain
    ) {
        try {
            // Skip JWT processing for public endpoints (login/register/refresh/logout only, NOT /me)
            if (request.requestURI.startsWith("/api/public/") ||
                request.requestURI == "/api/auth/login" ||
                request.requestURI == "/api/auth/register-parent" ||
                request.requestURI == "/api/auth/refresh" ||
                request.requestURI == "/api/auth/logout" ||
                request.requestURI.startsWith("/swagger-ui/") ||
                request.requestURI.startsWith("/v3/api-docs/") ||
                request.requestURI.startsWith("/oauth2/") ||
                request.requestURI.startsWith("/login/oauth2/code/")) {
                filterChain.doFilter(request, response)
                return
            }
            
            val token = resolveToken(request)
            if (token != null && SecurityContextHolder.getContext().authentication == null) {
                val username = jwtService.extractUsername(token)
                if (!username.isNullOrBlank()) {
                    try {
                        val userDetails = userDetailsService.loadUserByUsername(username)
                        logger.info("Loaded user details for: $username")
                        logger.info("User authorities: ${userDetails.authorities}")
                        logger.info("User enabled: ${userDetails.isEnabled}")
                        
                        if (jwtService.validateToken(token, userDetails)) {
                            val authentication = UsernamePasswordAuthenticationToken(
                                userDetails,
                                null,
                                userDetails.authorities
                            )
                            authentication.details = WebAuthenticationDetailsSource().buildDetails(request)
                            SecurityContextHolder.getContext().authentication = authentication
                            logger.info("✓ Successfully authenticated user: $username with authorities: ${userDetails.authorities}")
                            logger.info("Authentication object: isAuthenticated=${authentication.isAuthenticated}, principal=${authentication.principal.javaClass.simpleName}")
                        } else {
                            logger.warn("✗ Token validation failed for user: $username")
                            request.setAttribute("auth_error", "invalid_or_expired_token")
                        }
                    } catch (e: Exception) {
                        logger.error("✗ Error loading user details for username: $username", e)
                        request.setAttribute("auth_error", "user_details_error")
                    }
                } else {
                    logger.warn("Could not extract username from token")
                    request.setAttribute("auth_error", "token_no_username")
                }
            } else if (token == null) {
                logger.debug("No token found in request to ${request.requestURI}")
                request.setAttribute("auth_error", "missing_cookie")
            }
        } catch (e: Exception) {
            logger.error("Error in JWT authentication filter for request to ${request.requestURI}", e)
        }
        filterChain.doFilter(request, response)
    }

    private fun resolveToken(request: HttpServletRequest): String? {
        // First, try to get token from HttpOnly cookie (preferred method)
        val cookies = request.cookies
        if (cookies != null) {
            val tokenCookie = cookies.find { it.name == "access_token" }
            if (tokenCookie != null && StringUtils.hasText(tokenCookie.value)) {
                logger.trace("Token found in cookie for ${request.requestURI}")
                return tokenCookie.value
            }
        }
        
        // Fallback to Authorization header for backwards compatibility
        val bearer = request.getHeader("Authorization")
        if (StringUtils.hasText(bearer) && bearer.startsWith("Bearer ")) {
            logger.trace("Token found in Authorization header for ${request.requestURI}")
            return bearer.substring(7)
        }
        
        return null
    }
}