package com.club.triathlon.security

import com.fasterxml.jackson.databind.ObjectMapper
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import org.slf4j.LoggerFactory
import org.springframework.http.MediaType
import org.springframework.security.access.AccessDeniedException
import org.springframework.security.core.context.SecurityContextHolder
import org.springframework.security.web.access.AccessDeniedHandler
import org.springframework.stereotype.Component
import java.time.Instant

@Component
class CustomAccessDeniedHandler(
    private val objectMapper: ObjectMapper
) : AccessDeniedHandler {

    private val logger = LoggerFactory.getLogger(CustomAccessDeniedHandler::class.java)

    override fun handle(
        request: HttpServletRequest,
        response: HttpServletResponse,
        accessDeniedException: AccessDeniedException
    ) {
        val authentication = SecurityContextHolder.getContext().authentication
        
        logger.error("⚠️ ACCESS DENIED to ${request.method} ${request.requestURI}")
        logger.error("Authentication present: ${authentication != null}")
        if (authentication != null) {
            logger.error("Principal: ${authentication.principal}")
            logger.error("Authorities: ${authentication.authorities}")
            logger.error("Is authenticated: ${authentication.isAuthenticated}")
            logger.error("Details: ${authentication.details}")
        }
        logger.error("Exception: ${accessDeniedException.message}", accessDeniedException)

        response.status = HttpServletResponse.SC_FORBIDDEN
        response.contentType = MediaType.APPLICATION_JSON_VALUE

        val errorResponse = mapOf(
            "status" to 403,
            "error" to "Forbidden",
            "message" to "Access denied: You don't have permission to access this resource",
            "path" to request.requestURI,
            "timestamp" to Instant.now().toString(),
            "authenticated" to (authentication?.isAuthenticated ?: false),
            "authorities" to (authentication?.authorities?.map { it.authority } ?: emptyList<String>())
        )

        objectMapper.writeValue(response.writer, errorResponse)
    }
}

