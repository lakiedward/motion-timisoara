package com.club.triathlon.repo

import com.club.triathlon.domain.RefreshToken
import com.club.triathlon.domain.User
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query
import org.springframework.stereotype.Repository
import java.time.OffsetDateTime
import java.util.Optional
import java.util.UUID

@Repository
interface RefreshTokenRepository : JpaRepository<RefreshToken, UUID> {

    /**
     * Find refresh token by token string
     */
    fun findByToken(token: String): Optional<RefreshToken>

    /**
     * Find all valid (non-revoked, non-used, non-expired) tokens for a user
     */
    @Query(
        """
        SELECT rt FROM RefreshToken rt
        WHERE rt.user = :user
        AND rt.revoked = false
        AND rt.used = false
        AND rt.expiresAt > :now
        """
    )
    fun findValidTokensByUser(user: User, now: OffsetDateTime = OffsetDateTime.now()): List<RefreshToken>

    /**
     * Revoke all tokens for a user (useful for logout from all devices)
     */
    @Modifying
    @Query("UPDATE RefreshToken rt SET rt.revoked = true, rt.revokedAt = :now WHERE rt.user = :user AND rt.revoked = false")
    fun revokeAllUserTokens(user: User, now: OffsetDateTime = OffsetDateTime.now()): Int

    /**
     * Delete expired tokens (cleanup task)
     */
    @Modifying
    @Query("DELETE FROM RefreshToken rt WHERE rt.expiresAt < :cutoffDate")
    fun deleteExpiredTokens(cutoffDate: OffsetDateTime): Int

    /**
     * Count valid tokens for a user
     */
    @Query(
        """
        SELECT COUNT(rt) FROM RefreshToken rt
        WHERE rt.user = :user
        AND rt.revoked = false
        AND rt.used = false
        AND rt.expiresAt > :now
        """
    )
    fun countValidTokensByUser(user: User, now: OffsetDateTime = OffsetDateTime.now()): Long

    /**
     * Delete all tokens for a user (for user deletion)
     */
    @Modifying
    @Query("DELETE FROM RefreshToken rt WHERE rt.user = :user")
    fun deleteByUser(user: User): Int
}
