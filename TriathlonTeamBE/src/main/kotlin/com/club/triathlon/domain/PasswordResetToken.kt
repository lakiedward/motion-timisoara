package com.club.triathlon.domain

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.FetchType
import jakarta.persistence.Index
import jakarta.persistence.JoinColumn
import jakarta.persistence.ManyToOne
import jakarta.persistence.Table
import java.time.OffsetDateTime

@Entity
@Table(
    name = "password_reset_tokens",
    indexes = [
        Index(name = "idx_password_reset_token", columnList = "token", unique = true),
        Index(name = "idx_password_reset_user_id", columnList = "user_id")
    ]
)
class PasswordResetToken : BaseEntity() {

    @Column(name = "token", nullable = false, unique = true, length = 500)
    lateinit var token: String

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    lateinit var user: User

    @Column(name = "expires_at", nullable = false)
    lateinit var expiresAt: OffsetDateTime

    @Column(name = "created_at", nullable = false)
    lateinit var createdAt: OffsetDateTime

    @Column(name = "used", nullable = false)
    var used: Boolean = false

    @Column(name = "used_at")
    var usedAt: OffsetDateTime? = null

    fun isValid(now: OffsetDateTime = OffsetDateTime.now()): Boolean {
        return !used && expiresAt.isAfter(now)
    }

    fun markAsUsed() {
        used = true
        usedAt = OffsetDateTime.now()
    }
}
