package com.club.triathlon.config

import com.club.triathlon.security.UserPrincipal
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import org.slf4j.LoggerFactory
import org.springframework.security.core.context.SecurityContextHolder
import org.springframework.stereotype.Component
import org.springframework.web.servlet.HandlerInterceptor
import java.time.Instant
import java.util.UUID

@Component
class LoggingInterceptor : HandlerInterceptor {
    
    private val logger = LoggerFactory.getLogger(LoggingInterceptor::class.java)
    
    override fun preHandle(request: HttpServletRequest, response: HttpServletResponse, handler: Any): Boolean {
        val requestId = UUID.randomUUID().toString().substring(0, 8)
        request.setAttribute("requestId", requestId)
        request.setAttribute("startTime", System.currentTimeMillis())
        
        val user = getCurrentUser()
        val method = request.method
        val uri = request.requestURI
        val queryString = request.queryString
        val fullUrl = if (queryString != null) "$uri?$queryString" else uri
        
        logger.info("🚀 [REQUEST-$requestId] $method $fullUrl | User: $user | IP: ${getClientIpAddress(request)}")
        
        return true
    }
    
    override fun afterCompletion(
        request: HttpServletRequest, 
        response: HttpServletResponse, 
        handler: Any, 
        ex: Exception?
    ) {
        val requestId = request.getAttribute("requestId") as? String ?: "unknown"
        val startTime = request.getAttribute("startTime") as? Long ?: 0L
        val duration = System.currentTimeMillis() - startTime
        val status = response.status
        val method = request.method
        val uri = request.requestURI
        
        val user = getCurrentUser()
        
        when {
            ex != null -> {
                logger.error("❌ [RESPONSE-$requestId] $method $uri | Status: $status | Duration: ${duration}ms | User: $user | Error: ${ex.message}")
            }
            status >= 400 -> {
                logger.warn("⚠️ [RESPONSE-$requestId] $method $uri | Status: $status | Duration: ${duration}ms | User: $user")
            }
            else -> {
                logger.info("✅ [RESPONSE-$requestId] $method $uri | Status: $status | Duration: ${duration}ms | User: $user")
            }
        }
    }
    
    private fun getClientIpAddress(request: HttpServletRequest): String {
        val xForwardedFor = request.getHeader("X-Forwarded-For")
        return when {
            xForwardedFor != null && xForwardedFor.isNotEmpty() -> xForwardedFor.split(",")[0].trim()
            else -> request.remoteAddr ?: "unknown"
        }
    }
    
    private fun getCurrentUser(): String {
        return try {
            val authentication = SecurityContextHolder.getContext().authentication
            when {
                authentication == null -> "anonymous"
                !authentication.isAuthenticated -> "anonymous"
                authentication.principal is UserPrincipal -> {
                    val userPrincipal = authentication.principal as UserPrincipal
                    "${userPrincipal.user.email} (${userPrincipal.user.role})"
                }
                else -> authentication.name ?: "anonymous"
            }
        } catch (e: Exception) {
            logger.debug("Could not extract user from SecurityContext: ${e.message}")
            "anonymous"
        }
    }
}