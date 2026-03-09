package com.club.triathlon.repo

import com.club.triathlon.domain.CoachInvitationCode
import com.club.triathlon.domain.User
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import java.time.OffsetDateTime
import java.util.UUID

interface CoachInvitationCodeRepository : JpaRepository<CoachInvitationCode, UUID> {
    
    fun findByCode(code: String): CoachInvitationCode?
    
    fun findByCreatedByAdmin(admin: User): List<CoachInvitationCode>
    
    fun findByUsedByUser(user: User): CoachInvitationCode?
    
    fun existsByCode(code: String): Boolean
    
    @Query("""
        SELECT c FROM CoachInvitationCode c 
        WHERE c.currentUses < c.maxUses 
        AND (c.expiresAt IS NULL OR c.expiresAt > :now)
        ORDER BY c.createdAt DESC
    """)
    fun findAllValid(now: OffsetDateTime = OffsetDateTime.now()): List<CoachInvitationCode>
    
    @Query("""
        SELECT c FROM CoachInvitationCode c 
        ORDER BY c.createdAt DESC
    """)
    fun findAllOrderByCreatedAtDesc(): List<CoachInvitationCode>
}
