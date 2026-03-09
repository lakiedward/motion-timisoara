package com.club.triathlon.security

import jakarta.servlet.http.Cookie
import jakarta.servlet.http.HttpServletResponse
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Service

@Service
class AuthCookieService(
    @Value("\${app.use-secure-cookies:false}") private val useSecureCookies: Boolean,
    @Value("\${app.cookie.domain:}") private val cookieDomain: String,
    @Value("\${app.jwt.refresh-expiration-days:7}") private val refreshExpirationDays: Long
) {

    private val logger = LoggerFactory.getLogger(AuthCookieService::class.java)

    fun writeAuthCookies(response: HttpServletResponse, accessToken: String, refreshToken: String) {
        writeAccessCookie(response, accessToken)
        writeRefreshCookie(response, refreshToken)
    }

    fun clearAuthCookies(response: HttpServletResponse) {
        clearAccessCookie(response)
        clearRefreshCookie(response)
    }

    private fun writeAccessCookie(response: HttpServletResponse, token: String) {
        val cookie = Cookie("access_token", token)
        cookie.isHttpOnly = true
        cookie.secure = useSecureCookies
        cookie.path = "/"
        if (cookieDomain.isNotBlank()) {
            cookie.domain = cookieDomain
        }
        cookie.maxAge = 15 * 60
        cookie.setAttribute("SameSite", sameSite())
        response.addCookie(cookie)

        logger.info("🍪 [AuthCookie] Set access_token: secure={}, sameSite={}, domain={}, path={}, maxAge={}", 
            cookie.secure, sameSite(), if (cookieDomain.isNotBlank()) cookieDomain else "none", cookie.path, cookie.maxAge)
    }

    private fun writeRefreshCookie(response: HttpServletResponse, token: String) {
        val cookie = Cookie("refresh_token", token)
        cookie.isHttpOnly = true
        cookie.secure = useSecureCookies
        cookie.path = "/api/auth"
        if (cookieDomain.isNotBlank()) {
            cookie.domain = cookieDomain
        }
        // Convert days to seconds for maxAge
        cookie.maxAge = (refreshExpirationDays * 24 * 60 * 60).toInt()
        cookie.setAttribute("SameSite", sameSite())
        response.addCookie(cookie)

        logger.info("🍪 [AuthCookie] Set refresh_token: secure={}, sameSite={}, domain={}, path={}, maxAge={}", 
            cookie.secure, sameSite(), if (cookieDomain.isNotBlank()) cookieDomain else "none", cookie.path, cookie.maxAge)
    }

    private fun clearAccessCookie(response: HttpServletResponse) {
        val cookie = Cookie("access_token", "")
        cookie.isHttpOnly = true
        cookie.secure = useSecureCookies
        cookie.path = "/"
        if (cookieDomain.isNotBlank()) {
            cookie.domain = cookieDomain
        }
        cookie.maxAge = 0
        cookie.setAttribute("SameSite", sameSite())
        response.addCookie(cookie)

        logger.debug("Cleared access token cookie (secure={}, sameSite={})", cookie.secure, sameSite())
    }

    private fun clearRefreshCookie(response: HttpServletResponse) {
        val cookie = Cookie("refresh_token", "")
        cookie.isHttpOnly = true
        cookie.secure = useSecureCookies
        cookie.path = "/api/auth"
        if (cookieDomain.isNotBlank()) {
            cookie.domain = cookieDomain
        }
        cookie.maxAge = 0
        cookie.setAttribute("SameSite", sameSite())
        response.addCookie(cookie)

        logger.debug("Cleared refresh token cookie (secure={}, sameSite={})", cookie.secure, sameSite())
    }

    private fun sameSite(): String = if (useSecureCookies) "None" else "Lax"
}

