package com.club.triathlon.security

import com.club.triathlon.domain.User
import org.slf4j.LoggerFactory
import org.springframework.security.core.GrantedAuthority
import org.springframework.security.core.authority.SimpleGrantedAuthority
import org.springframework.security.core.userdetails.UserDetails

class UserPrincipal(val user: User) : UserDetails {

    private val logger = LoggerFactory.getLogger(UserPrincipal::class.java)
    private val authority = SimpleGrantedAuthority("ROLE_${user.role.name}")

    init {
        logger.debug("Creating UserPrincipal for user: ${user.email}, role: ${user.role.name}, enabled: ${user.enabled}")
        logger.debug("Authority created: $authority")
    }

    override fun getAuthorities(): MutableCollection<out GrantedAuthority> = mutableListOf(authority)

    override fun getPassword(): String = user.passwordHash ?: ""

    override fun getUsername(): String = user.email

    override fun isAccountNonExpired(): Boolean = true

    override fun isAccountNonLocked(): Boolean = true

    override fun isCredentialsNonExpired(): Boolean = true

    override fun isEnabled(): Boolean = user.enabled
}