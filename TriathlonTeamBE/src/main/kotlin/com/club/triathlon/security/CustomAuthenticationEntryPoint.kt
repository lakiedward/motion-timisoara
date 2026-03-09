package com.club.triathlon.security

import com.fasterxml.jackson.databind.ObjectMapper
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import org.springframework.http.MediaType
import org.springframework.security.core.AuthenticationException
import org.springframework.security.web.AuthenticationEntryPoint
import org.springframework.stereotype.Component
import java.time.Instant

@Component
class CustomAuthenticationEntryPoint(
    private val objectMapper: ObjectMapper
) : AuthenticationEntryPoint {

    override fun commence(
        request: HttpServletRequest,
        response: HttpServletResponse,
        authException: AuthenticationException
    ) {
        response.status = HttpServletResponse.SC_UNAUTHORIZED
        response.contentType = MediaType.APPLICATION_JSON_VALUE

        val reason = (request.getAttribute("auth_error") as? String) ?: "unknown"
        val hasAccessCookie = request.cookies?.any { it.name == "access_token" && it.value?.isNotBlank() == true } ?: false
        val origin = request.getHeader("Origin") ?: ""
        val hint = when (reason) {
            "missing_cookie" -> "Auth cookie missing. Ensure USE_SECURE_COOKIES=true on BE (SameSite=None; Secure), FE sends withCredentials, and you re-login."
            "invalid_or_expired_token" -> "Token invalid or expired. Re-login to obtain a fresh token."
            "token_no_username" -> "Malformed token (no username). Re-authenticate."
            "user_details_error" -> "User lookup failed while validating token. Check user status and logs."
            else -> authException.message ?: "Invalid or missing token"
        }

        val errorResponse = mapOf(
            "status" to 401,
            "error" to "Unauthorized",
            "message" to "Authentication failed",
            "reason" to reason,
            "hint" to hint,
            "hasAccessCookie" to hasAccessCookie,
            "origin" to origin,
            "method" to request.method,
            "path" to request.requestURI,
            "timestamp" to Instant.now().toString()
        )

        objectMapper.writeValue(response.writer, errorResponse)
    }
}


