package com.club.triathlon.repo

import com.club.triathlon.domain.Course
import com.club.triathlon.domain.User
import com.club.triathlon.domain.Club
import org.springframework.data.jpa.repository.EntityGraph
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import java.util.UUID

interface CourseRepository : JpaRepository<Course, UUID>, CourseRepositoryCustom {

    @EntityGraph(attributePaths = ["coach", "location", "sport"])
    @Query("select c from Course c")
    fun findAllWithCoachAndLocation(): List<Course>

    @EntityGraph(attributePaths = ["location", "sport"])
    fun findByCoach(coach: User): List<Course>
    
    @EntityGraph(attributePaths = ["coach", "location", "sport"])
    fun findByCoachIn(coaches: Collection<User>): List<Course>
    
    @Query("SELECT COUNT(c) FROM Course c WHERE c.club.id = :clubId")
    fun countByClubId(clubId: UUID): Long

    @Query("SELECT c FROM Course c WHERE c.club.id = :clubId")
    fun findByClubId(clubId: UUID): List<Course>
    
    @Query("DELETE FROM Course c WHERE c.club.id = :clubId")
    @org.springframework.data.jpa.repository.Modifying
    fun deleteAllByClubId(clubId: UUID)
    
    fun existsByLocationId(locationId: UUID): Boolean
    
    @Query("SELECT COUNT(c) FROM Course c WHERE c.location.id = :locationId")
    fun countByLocationId(locationId: UUID): Long
    
    fun existsByCoachAndClubAndActiveTrue(coach: User, club: Club): Boolean

    fun existsByCoachAndClub(coach: User, club: Club): Boolean
}
