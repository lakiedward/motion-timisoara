package com.club.triathlon.security

import com.auth0.jwt.JWT
import com.auth0.jwt.algorithms.Algorithm
import com.auth0.jwt.exceptions.JWTVerificationException
import com.auth0.jwt.interfaces.DecodedJWT
import com.club.triathlon.domain.RefreshToken
import com.club.triathlon.domain.User
import com.club.triathlon.repo.RefreshTokenRepository
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.security.core.userdetails.UserDetails
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.security.SecureRandom
import java.time.Instant
import java.time.OffsetDateTime
import java.time.temporal.ChronoUnit
import java.util.Base64
import java.util.Date

@Service
class JwtService(
    @Value("\${app.jwt.secret}") private val secret: String,
    @Value("\${app.jwt.expiration-minutes}") private val expirationMinutes: Long,
    @Value("\${app.jwt.refresh-expiration-days}") private val refreshExpirationDays: Long,
    private val refreshTokenRepository: RefreshTokenRepository
) {

    private val logger = LoggerFactory.getLogger(JwtService::class.java)

    companion object {
        private const val REFRESH_TOKEN_LENGTH = 64 // 512 bits when base64 encoded
        private val secureRandom = SecureRandom()
    }

    init {
        // Critical security check: JWT secret MUST be set and strong
        require(secret.isNotBlank()) {
            "JWT_SECRET must be set. Never use default secrets in production!"
        }
        require(secret != "CHANGE_ME_VERY_SECRET_FOR_LOCAL_DEV_ONLY") {
            "JWT_SECRET default value detected! Set a strong secret via environment variable."
        }
        require(secret.length >= 32) {
            "JWT_SECRET must be at least 32 characters for HMAC512. Current length: ${secret.length}"
        }
    }

    private val algorithm: Algorithm by lazy { Algorithm.HMAC512(secret) }

    fun generateToken(user: User): String {
        val now = Instant.now()
        val expiresAt = now.plus(expirationMinutes, ChronoUnit.MINUTES)
        return JWT.create()
            .withSubject(user.email)
            .withClaim("role", user.role.name)
            .withIssuedAt(Date.from(now))
            .withExpiresAt(Date.from(expiresAt))
            .sign(algorithm)
    }

    fun validateToken(token: String, userDetails: UserDetails): Boolean {
        val decoded = decode(token) ?: return false
        return decoded.subject == userDetails.username && decoded.expiresAt?.before(Date()) == false
    }

    fun extractUsername(token: String): String? = decode(token)?.subject

    fun extractRole(token: String): String? = decode(token)?.getClaim("role")?.asString()

    private fun decode(token: String): DecodedJWT? = try {
        JWT.require(algorithm).build().verify(token)
    } catch (ex: JWTVerificationException) {
        null
    }

    // ===== REFRESH TOKEN METHODS =====

    /**
     * Generate a cryptographically secure refresh token
     * Returns: Base64-encoded random token (512 bits)
     */
    private fun generateSecureToken(): String {
        val bytes = ByteArray(REFRESH_TOKEN_LENGTH)
        secureRandom.nextBytes(bytes)
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes)
    }

    /**
     * Create and save a new refresh token for a user
     */
    @Transactional
    fun createRefreshToken(user: User): RefreshToken {
        val token = RefreshToken().apply {
            this.token = generateSecureToken()
            this.user = user
            this.createdAt = OffsetDateTime.now()
            this.expiresAt = OffsetDateTime.now().plusDays(refreshExpirationDays)
        }
        return refreshTokenRepository.save(token)
    }

    /**
     * Validate and consume refresh token, returning the user
     * The token is marked as used after validation (one-time use)
     */
    @Transactional
    fun validateAndConsumeRefreshToken(tokenString: String): User? {
        val refreshToken = refreshTokenRepository.findByToken(tokenString).orElse(null)
            ?: return null

        // Standard validation: must not be revoked and must not be expired
        if (refreshToken.revoked || refreshToken.expiresAt.isBefore(OffsetDateTime.now())) {
            logger.warn("Refresh token validation failed: revoked=${refreshToken.revoked}, expired=${refreshToken.expiresAt.isBefore(OffsetDateTime.now())}")
            return null
        }

        // Handle token reuse (rotation)
        if (refreshToken.used) {
            // Grace period: Allow reuse within 60 seconds to handle concurrent requests (e.g. multiple tabs)
            val usedAt = refreshToken.usedAt
            if (usedAt != null && usedAt.plusSeconds(60).isAfter(OffsetDateTime.now())) {
                val user = refreshToken.user
                // Force initialize proxy while the Hibernate session is still open.
                user.email
                user.role

                logger.info("Allowing reuse of refresh token within grace period (60s) for user: ${user.email}")
                return user
            }
            
            // Reuse outside grace period indicates potential theft or replay
            logger.warn("BLOCKED refresh token reuse outside grace period for user: ${refreshToken.user.email}")
            return null
        }

        // Mark as used (one-time use for security)
        refreshToken.markAsUsed()
        refreshTokenRepository.save(refreshToken)

        val user = refreshToken.user
        // Force initialize proxy while the Hibernate session is still open.
        user.email
        user.role

        return user
    }

    /**
     * Revoke all refresh tokens for a user (logout from all devices)
     */
    @Transactional
    fun revokeAllUserTokens(user: User): Int {
        return refreshTokenRepository.revokeAllUserTokens(user)
    }

    /**
     * Cleanup expired refresh tokens (scheduled task)
     */
    @Transactional
    fun cleanupExpiredTokens(): Int {
        val cutoffDate = OffsetDateTime.now().minusDays(refreshExpirationDays * 2) // Keep 2x for audit
        return refreshTokenRepository.deleteExpiredTokens(cutoffDate)
    }
}