package com.club.triathlon.util

import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

class IpDetectionUtilsTest {

    @Test
    fun `looksLikeIp detects IPv4 and IPv6 literals but not colon-containing non-IPs`() {
        assertTrue(IpDetectionUtils.looksLikeIp("127.0.0.1"))
        assertFalse(IpDetectionUtils.looksLikeIp("999.1.1.1"))

        assertTrue(IpDetectionUtils.looksLikeIp("2001:db8::1"))
        assertTrue(IpDetectionUtils.looksLikeIp("fe80::1%lo0"))
        assertTrue(IpDetectionUtils.looksLikeIp("[2001:db8::1]"))

        assertFalse(IpDetectionUtils.looksLikeIp("10:30:00"))
        assertFalse(IpDetectionUtils.looksLikeIp("https://example.com"))
        assertFalse(IpDetectionUtils.looksLikeIp("status: active"))
        assertFalse(IpDetectionUtils.looksLikeIp("{\"time\":\"10:30:00\"}"))
    }

    @Test
    fun `looksLikeIpv4 validates IPv4 format correctly`() {
        assertTrue(IpDetectionUtils.looksLikeIpv4("192.168.1.1"))
        assertTrue(IpDetectionUtils.looksLikeIpv4("0.0.0.0"))
        assertTrue(IpDetectionUtils.looksLikeIpv4("255.255.255.255"))
        
        assertFalse(IpDetectionUtils.looksLikeIpv4("256.1.1.1"))
        assertFalse(IpDetectionUtils.looksLikeIpv4("1.2.3"))
        assertFalse(IpDetectionUtils.looksLikeIpv4("1.2.3.4.5"))
        assertFalse(IpDetectionUtils.looksLikeIpv4("abc.def.ghi.jkl"))
    }

    @Test
    fun `looksLikeIpv6Literal validates IPv6 format correctly`() {
        assertTrue(IpDetectionUtils.looksLikeIpv6Literal("::1"))
        assertTrue(IpDetectionUtils.looksLikeIpv6Literal("2001:db8::1"))
        assertTrue(IpDetectionUtils.looksLikeIpv6Literal("fe80::1%eth0"))
        assertTrue(IpDetectionUtils.looksLikeIpv6Literal("[2001:db8::1]"))
        
        assertFalse(IpDetectionUtils.looksLikeIpv6Literal("not-an-ip"))
        assertFalse(IpDetectionUtils.looksLikeIpv6Literal("192.168.1.1"))
        assertFalse(IpDetectionUtils.looksLikeIpv6Literal("hello:world"))
    }

    @Test
    fun `looksLikeIpv4 handles edge cases`() {
        // Empty string
        assertFalse(IpDetectionUtils.looksLikeIpv4(""))
        
        // Whitespace-only
        assertFalse(IpDetectionUtils.looksLikeIpv4("   "))
        
        // IPv4 with leading zeros (still valid octets if in 0-255 range)
        assertTrue(IpDetectionUtils.looksLikeIpv4("01.02.03.04"))
    }

    @Test
    fun `looksLikeIpv6Literal handles edge cases`() {
        // Empty string
        assertFalse(IpDetectionUtils.looksLikeIpv6Literal(""))
        
        // Whitespace-only
        assertFalse(IpDetectionUtils.looksLikeIpv6Literal("   "))
        
        // IPv4-mapped IPv6 - JVM returns Inet4Address for this, so looksLikeIpv6Literal returns false
        // However, looksLikeIp should still catch it via IPv4 detection for the embedded address
        assertFalse(IpDetectionUtils.looksLikeIpv6Literal("::ffff:192.168.1.1"))
        
        // Full IPv6 loopback form
        assertTrue(IpDetectionUtils.looksLikeIpv6Literal("0:0:0:0:0:0:0:1"))
    }

    @Test
    fun `looksLikeIpv6Literal handles zone IDs with various interface names`() {
        // Zone ID with letters that aren't hex (l, o, t, h)
        assertTrue(IpDetectionUtils.looksLikeIpv6Literal("fe80::1%lo0"))
        assertTrue(IpDetectionUtils.looksLikeIpv6Literal("fe80::1%eth0"))
        assertTrue(IpDetectionUtils.looksLikeIpv6Literal("fe80::1%en0"))
        
        // Bracketed form with zone ID
        assertTrue(IpDetectionUtils.looksLikeIpv6Literal("[fe80::1%lo0]"))
    }
}
