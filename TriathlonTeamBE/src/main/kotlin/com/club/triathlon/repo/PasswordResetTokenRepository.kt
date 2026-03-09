package com.club.triathlon.repo

import com.club.triathlon.domain.PasswordResetToken
import com.club.triathlon.domain.User
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query
import org.springframework.stereotype.Repository
import java.util.Optional
import java.util.UUID

@Repository
interface PasswordResetTokenRepository : JpaRepository<PasswordResetToken, UUID> {
    fun findByToken(token: String): Optional<PasswordResetToken>
    
    @Modifying
    @Query("DELETE FROM PasswordResetToken prt WHERE prt.user = :user")
    fun deleteByUser(user: User): Int
}
