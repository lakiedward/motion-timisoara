package com.club.triathlon.domain

import com.club.triathlon.enums.Role
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.EnumType
import jakarta.persistence.Enumerated
import jakarta.persistence.Table
import java.time.OffsetDateTime

@Entity
@Table(name = "users")
open class User : BaseEntity() {

    @Column(name = "email", nullable = false, unique = true)
    lateinit var email: String

    @Column(name = "password_hash")
    var passwordHash: String? = null

    @Column(name = "name", nullable = false)
    lateinit var name: String

    @Column(name = "phone")
    var phone: String? = null

    @Column(name = "oauth_provider", length = 50)
    var oauthProvider: String? = null

    @Column(name = "oauth_provider_id", length = 255)
    var oauthProviderId: String? = null

    @Column(name = "avatar_url")
    var avatarUrl: String? = null

    @Enumerated(EnumType.STRING)
    @Column(name = "role", nullable = false, length = 32)
    lateinit var role: Role

    @Column(name = "created_at", nullable = false)
    lateinit var createdAt: OffsetDateTime

    @Column(name = "enabled", nullable = false)
    var enabled: Boolean = true

    fun markOAuthLogin(provider: String, providerId: String, avatarUrl: String? = null) {
        this.oauthProvider = provider
        this.oauthProviderId = providerId
        if (!avatarUrl.isNullOrBlank()) {
            this.avatarUrl = avatarUrl
        }
    }

    fun requiresProfileCompletion(): Boolean = this.phone.isNullOrBlank()

    override fun toString(): String {
        return "User(id=$id, email=$email, name=$name, phone=$phone, role=$role, createdAt=$createdAt)"
    }
}
