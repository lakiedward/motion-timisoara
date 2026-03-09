package com.club.triathlon.repo

import com.club.triathlon.domain.Activity
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import org.springframework.stereotype.Repository
import java.time.LocalDate
import java.util.UUID

@Repository
interface ActivityRepository : JpaRepository<Activity, UUID> {

    @Query("""
        SELECT a FROM Activity a 
        LEFT JOIN FETCH a.coach 
        LEFT JOIN FETCH a.location 
        LEFT JOIN FETCH a.sport
        ORDER BY a.activityDate DESC, a.startTime ASC
    """)
    fun findAllWithDetails(): List<Activity>

    @Query("""
        SELECT a FROM Activity a 
        LEFT JOIN FETCH a.coach 
        LEFT JOIN FETCH a.location 
        LEFT JOIN FETCH a.sport
        WHERE a.coach.id = :coachId
        ORDER BY a.activityDate DESC, a.startTime ASC
    """)
    fun findAllByCoachIdWithDetails(coachId: UUID): List<Activity>

    @Query("""
        SELECT a FROM Activity a 
        LEFT JOIN FETCH a.coach 
        LEFT JOIN FETCH a.location 
        LEFT JOIN FETCH a.sport
        WHERE a.active = true
        ORDER BY a.activityDate ASC, a.startTime ASC
    """)
    fun findAllActiveWithDetails(): List<Activity>

    @Query("""
        SELECT a FROM Activity a 
        LEFT JOIN FETCH a.coach 
        LEFT JOIN FETCH a.location 
        LEFT JOIN FETCH a.sport
        WHERE a.active = true AND a.activityDate >= :fromDate
        ORDER BY a.activityDate ASC, a.startTime ASC
    """)
    fun findUpcomingActiveWithDetails(fromDate: LocalDate): List<Activity>

    fun findByCoachId(coachId: UUID): List<Activity>

    @Query("SELECT a FROM Activity a WHERE a.club.id = :clubId")
    fun findByClubId(clubId: UUID): List<Activity>

    @Query("SELECT COUNT(a) FROM Activity a WHERE a.club.id = :clubId")
    fun countByClubId(clubId: UUID): Long
    
    fun existsByLocationId(locationId: UUID): Boolean
}
