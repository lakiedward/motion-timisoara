package com.club.triathlon.util

import jakarta.servlet.http.HttpServletRequest

import java.net.InetAddress
import java.net.UnknownHostException

object RequestUtils {
    /**
     * Extracts the client IP address from the request.
     *
     * Security Model:
     * - The X-Forwarded-For header is ONLY trusted if the immediate upstream peer (request.remoteAddr)
     *   is in the [trustedProxies] list.
     * - If [trustedProxies] is empty, X-Forwarded-For is ignored.
     * - IP address comparison is performed by normalizing addresses (resolving via InetAddress)
     *   to handle IPv6 and different string representations correctly.
     *
     * Parsing Behavior:
     * - X-Forwarded-For can contain multiple IPs: "client, proxy1, proxy2".
     * - We take the FIRST non-blank entry to get the original client IP.
     * - Entries are trimmed of whitespace.
     *
     * Usage:
     * - Use for audit logging, rate limiting, and geographic analysis.
     * - Note: If the request comes from a non-trusted proxy, the remoteAddr is returned.
     */
    fun extractClientIp(request: HttpServletRequest, trustedProxies: List<String> = emptyList()): String {
        val remoteAddr = request.remoteAddr ?: "unknown"

        // Strict mode: only trust X-Forwarded-For when the immediate peer (remoteAddr)
        // is explicitly configured as a trusted proxy.
        // Normalize IPs for comparison to handle IPv6 and different formats.
        val isTrusted = try {
             trustedProxies.any { proxy ->
                 try {
                     val proxyAddr = InetAddress.getByName(proxy).hostAddress
                     val remoteAddrNormalized = InetAddress.getByName(remoteAddr).hostAddress
                     proxyAddr == remoteAddrNormalized
                 } catch (e: UnknownHostException) {
                     false
                 }
             }
        } catch (e: Exception) {
            false
        }

        if (!isTrusted) {
            return remoteAddr
        }

        val rawHeader = request.getHeader("X-Forwarded-For")
        return if (!rawHeader.isNullOrBlank()) {
            rawHeader.split(",").firstOrNull { it.isNotBlank() }?.trim() ?: remoteAddr
        } else {
            remoteAddr
        }
    }
}
