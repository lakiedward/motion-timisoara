package com.club.triathlon.domain

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.FetchType
import jakarta.persistence.JoinColumn
import jakarta.persistence.ManyToOne
import jakarta.persistence.Table
import java.time.OffsetDateTime

@Entity
@Table(name = "coach_invitation_codes")
open class CoachInvitationCode : BaseEntity() {

    @Column(name = "code", nullable = false, unique = true, length = 50)
    lateinit var code: String

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "created_by_admin_id", nullable = false)
    lateinit var createdByAdmin: User

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "used_by_user_id")
    var usedByUser: User? = null

    @Column(name = "used_at")
    var usedAt: OffsetDateTime? = null

    @Column(name = "created_at", nullable = false)
    lateinit var createdAt: OffsetDateTime

    @Column(name = "expires_at")
    var expiresAt: OffsetDateTime? = null

    @Column(name = "max_uses", nullable = false)
    var maxUses: Int = 1

    @Column(name = "current_uses", nullable = false)
    var currentUses: Int = 0

    @Column(name = "notes", length = 500)
    var notes: String? = null

    /**
     * Check if this invitation code is still valid for use
     */
    fun isValid(): Boolean {
        // Check if max uses reached
        if (currentUses >= maxUses) return false
        
        // Check if expired
        if (expiresAt != null && OffsetDateTime.now().isAfter(expiresAt)) return false
        
        return true
    }

    /**
     * Check if this code has been fully used
     */
    fun isFullyUsed(): Boolean = currentUses >= maxUses

    /**
     * Check if this code has expired
     */
    fun isExpired(): Boolean = expiresAt != null && OffsetDateTime.now().isAfter(expiresAt)
}
