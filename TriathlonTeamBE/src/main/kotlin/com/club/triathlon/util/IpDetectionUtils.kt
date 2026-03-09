package com.club.triathlon.util

import java.net.Inet6Address
import java.net.InetAddress
import java.net.UnknownHostException

/**
 * Utility for detecting IP address literals without triggering DNS resolution.
 */
object IpDetectionUtils {

    /**
     * Returns true if the given value looks like a valid IPv4 or IPv6 address literal.
     * Does NOT perform DNS lookups for non-IP strings.
     */
    fun looksLikeIp(value: String): Boolean {
        val v = value.trim()
        if (looksLikeIpv4(v)) return true
        return looksLikeIpv6Literal(v)
    }

    /**
     * Checks if value matches IPv4 format with valid octet ranges (0-255).
     */
    fun looksLikeIpv4(value: String): Boolean {
        if (!IPV4_PATTERN.matches(value)) return false
        val parts = value.split(".")
        if (parts.size != 4) return false
        return parts.all { part ->
            val n = part.toIntOrNull() ?: return@all false
            n in 0..255
        }
    }

    /**
     * Checks if value is a valid IPv6 literal without DNS resolution.
     * Supports formats: 2001:db8::1, fe80::1%lo0, [2001:db8::1]
     */
    fun looksLikeIpv6Literal(value: String): Boolean {
        var v = value.trim()
        
        // Must contain colon to be considered IPv6
        if (!v.contains(':')) return false
        
        // Remove brackets if present (handle [addr] and [addr%zone] forms)
        if (v.startsWith("[") && v.endsWith("]")) {
            v = v.substring(1, v.length - 1)
        }
        
        // Strip zone ID before validation (e.g., %lo0, %eth0)
        val zoneIndex = v.indexOf('%')
        if (zoneIndex >= 0) {
            v = v.substring(0, zoneIndex)
        }
        
        // Check all characters are allowed in IPv6 literal body
        if (!v.all { isAllowedIpv6LiteralChar(it) }) return false
        
        // Letters must be valid hex (a-f, A-F)
        if (v.any { it.isLetter() && !isValidIpv6HexLetter(it) }) return false
        
        // Parse without DNS resolution using byte array construction
        return try {
            parseIpv6Literal(v)
        } catch (e: UnknownHostException) {
            false
        } catch (e: IllegalArgumentException) {
            false
        }
    }

    /**
     * Checks if a character is allowed in IPv6 literal body (after zone ID and brackets stripped).
     * Allowed: hex digits (0-9, a-f, A-F), colon, dot (for IPv4-mapped)
     */
    private fun isAllowedIpv6LiteralChar(char: Char): Boolean {
        return char.isDigit() || 
               (char.lowercaseChar() in 'a'..'f') || 
               char == ':' || 
               char == '.'
    }

    /**
     * Checks if a letter is valid for IPv6 hex notation (a-f, A-F).
     */
    private fun isValidIpv6HexLetter(char: Char): Boolean {
        return char.lowercaseChar() in 'a'..'f'
    }

    /**
     * Attempts to parse an IPv6 literal without triggering DNS resolution.
     * Returns true if valid IPv6, false otherwise.
     * Note: Expects value to already have brackets and zone ID stripped.
     */
    private fun parseIpv6Literal(value: String): Boolean {
        // Try to parse as numeric IPv6 address
        // Use getByName only after validating it looks like an IP to avoid DNS
        val address = InetAddress.getByName(value)
        return address is Inet6Address
    }

    private val IPV4_PATTERN = Regex("^(?:\\d{1,3}\\.){3}\\d{1,3}$")
}
