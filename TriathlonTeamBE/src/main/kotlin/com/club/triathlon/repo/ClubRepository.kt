package com.club.triathlon.repo

import com.club.triathlon.domain.Club
import com.club.triathlon.domain.User
import jakarta.persistence.LockModeType
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Lock
import org.springframework.data.jpa.repository.Query
import java.util.UUID

interface ClubRepository : JpaRepository<Club, UUID> {
    fun findByOwner(owner: User): Club?
    fun existsByOwner(owner: User): Boolean
    
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT c FROM Club c LEFT JOIN FETCH c.coaches WHERE c.id = :id")
    fun findByIdWithLock(id: UUID): Club?
    
    @Query("SELECT COUNT(c) FROM Club cl JOIN cl.coaches c WHERE cl.id = :clubId")
    fun countCoachesByClubId(clubId: UUID): Long
    
    @Query("SELECT c FROM Club c WHERE c.owner.id = :ownerId")
    fun findByOwnerId(ownerId: UUID): Club?
    
    @Query("SELECT c FROM Club c WHERE LOWER(c.name) LIKE LOWER(CONCAT('%', :name, '%'))")
    fun findByNameContainingIgnoreCase(name: String): List<Club>
    
    @Query("SELECT c FROM Club c JOIN c.coaches coach WHERE coach.id = :coachProfileId")
    fun findByCoachProfileId(coachProfileId: UUID): List<Club>
    
    @Query("SELECT c FROM Club c WHERE c.stripeOnboardingComplete = true")
    fun findAllWithStripeComplete(): List<Club>
}
