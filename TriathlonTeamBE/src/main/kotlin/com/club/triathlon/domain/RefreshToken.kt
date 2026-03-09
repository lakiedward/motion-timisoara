package com.club.triathlon.domain

import jakarta.persistence.*
import java.time.OffsetDateTime
import java.util.UUID

/**
 * Refresh Token entity for secure token rotation
 *
 * Security features:
 * - One-time use tokens (revoked after use)
 * - Automatic expiration (7 days default)
 * - Linked to specific user
 * - Can be revoked manually
 */
@Entity
@Table(
    name = "refresh_tokens",
    indexes = [
        Index(name = "idx_refresh_token", columnList = "token", unique = true),
        Index(name = "idx_refresh_user_id", columnList = "user_id")
    ]
)
class RefreshToken : BaseEntity() {

    @Column(name = "token", nullable = false, unique = true, length = 500)
    lateinit var token: String

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    lateinit var user: User

    @Column(name = "expires_at", nullable = false)
    lateinit var expiresAt: OffsetDateTime

    @Column(name = "created_at", nullable = false)
    lateinit var createdAt: OffsetDateTime

    @Column(name = "revoked", nullable = false)
    var revoked: Boolean = false

    @Column(name = "revoked_at")
    var revokedAt: OffsetDateTime? = null

    @Column(name = "used", nullable = false)
    var used: Boolean = false

    @Column(name = "used_at")
    var usedAt: OffsetDateTime? = null

    /**
     * Check if token is valid (not expired, not revoked, not used)
     */
    fun isValid(): Boolean {
        val now = OffsetDateTime.now()
        return !revoked && !used && expiresAt.isAfter(now)
    }

    /**
     * Mark token as used
     */
    fun markAsUsed() {
        used = true
        usedAt = OffsetDateTime.now()
    }

    /**
     * Revoke token manually
     */
    fun revoke() {
        revoked = true
        revokedAt = OffsetDateTime.now()
    }
}
