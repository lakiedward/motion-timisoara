package com.club.triathlon.repo

import com.club.triathlon.domain.ClubAnnouncement
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import java.util.UUID

interface ClubAnnouncementRepository : JpaRepository<ClubAnnouncement, UUID> {
    
    @Query("SELECT a FROM ClubAnnouncement a WHERE a.club.id = :clubId ORDER BY a.createdAt DESC")
    fun findByClubIdOrderByCreatedAtDesc(clubId: UUID): List<ClubAnnouncement>
    
    fun findByClubIdAndId(clubId: UUID, id: UUID): ClubAnnouncement?
    
    fun countByClubIdAndIsActive(clubId: UUID, isActive: Boolean): Long
}
