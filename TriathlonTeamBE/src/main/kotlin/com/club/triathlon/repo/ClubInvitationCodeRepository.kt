package com.club.triathlon.repo

import com.club.triathlon.domain.Club
import com.club.triathlon.domain.ClubInvitationCode
import com.club.triathlon.domain.CoachProfile
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import java.util.UUID

interface ClubInvitationCodeRepository : JpaRepository<ClubInvitationCode, UUID> {
    fun findByCode(code: String): ClubInvitationCode?
    fun existsByCode(code: String): Boolean
    fun findByClub(club: Club): List<ClubInvitationCode>
    fun findByClubOrderByCreatedAtDesc(club: Club): List<ClubInvitationCode>
    fun findByUsedByCoach(coach: CoachProfile): List<ClubInvitationCode>
    
    @Query("SELECT c FROM ClubInvitationCode c WHERE c.code = :code AND c.currentUses < c.maxUses AND (c.expiresAt IS NULL OR c.expiresAt > CURRENT_TIMESTAMP)")
    fun findValidByCode(code: String): ClubInvitationCode?
}
