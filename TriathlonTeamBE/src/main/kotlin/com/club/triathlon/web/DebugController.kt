package com.club.triathlon.web

import com.club.triathlon.security.UserPrincipal
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.security.core.context.SecurityContextHolder
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController
import java.time.Instant

/**
 * Debug controller to help troubleshoot authentication issues
 * TODO: Remove or secure this in production
 */
@RestController
@RequestMapping("/api/debug")
class DebugController {

    @GetMapping("/auth-status")
    fun getAuthStatus(@AuthenticationPrincipal principal: UserPrincipal?): Map<String, Any?> {
        val authentication = SecurityContextHolder.getContext().authentication
        
        return mapOf(
            "timestamp" to Instant.now().toString(),
            "isAuthenticated" to (authentication?.isAuthenticated ?: false),
            "hasAuthentication" to (authentication != null),
            "principal" to if (principal != null) {
                mapOf(
                    "userId" to principal.user.id,
                    "email" to principal.user.email,
                    "name" to principal.user.name,
                    "role" to principal.user.role.name,
                    "authorities" to principal.authorities.map { it.authority }
                )
            } else {
                null
            },
            "authenticationDetails" to if (authentication != null) {
                mapOf(
                    "principal" to authentication.principal?.javaClass?.simpleName,
                    "authorities" to authentication.authorities.map { it.authority },
                    "isAuthenticated" to authentication.isAuthenticated
                )
            } else {
                null
            }
        )
    }

    @GetMapping("/headers")
    fun getHeaders(
        @org.springframework.web.bind.annotation.RequestHeader headers: Map<String, String>
    ): Map<String, Any?> {
        val authHeader = headers["authorization"] ?: headers["Authorization"]
        return mapOf(
            "timestamp" to Instant.now().toString(),
            "hasAuthorizationHeader" to (authHeader != null),
            "authorizationHeaderValue" to if (authHeader != null) {
                if (authHeader.startsWith("Bearer ")) {
                    "Bearer ${authHeader.substring(7, minOf(27, authHeader.length))}..."
                } else {
                    authHeader
                }
            } else {
                null
            },
            "allHeaders" to headers.keys.sorted()
        )
    }
}

