package com.club.triathlon.repo

import com.club.triathlon.domain.User
import com.club.triathlon.enums.Role
import org.springframework.data.jpa.repository.JpaRepository
import java.util.Optional
import java.util.UUID

interface UserRepository : JpaRepository<User, UUID> {
    fun findByEmail(email: String): Optional<User>
    fun existsByEmail(email: String): Boolean
    fun findAllByRole(role: Role): List<User>
}
