package com.club.triathlon.repo

import com.club.triathlon.domain.CoachRating
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import java.util.Optional
import java.util.UUID

interface CoachRatingRepository : JpaRepository<CoachRating, UUID> {
    
    fun findByCoachIdAndParentId(coachId: UUID, parentId: UUID): Optional<CoachRating>
    
    fun existsByCoachIdAndParentId(coachId: UUID, parentId: UUID): Boolean
    
    fun findAllByParentId(parentId: UUID): List<CoachRating>
    
    fun findAllByCoachId(coachId: UUID): List<CoachRating>
    
    @Query(
        """
        select coalesce(avg(cr.rating), 0.0) 
        from CoachRating cr 
        where cr.coach.id = :coachId
        """
    )
    fun getAverageRatingByCoachId(@Param("coachId") coachId: UUID): Double
    
    @Query(
        """
        select count(cr) 
        from CoachRating cr 
        where cr.coach.id = :coachId
        """
    )
    fun countByCoachId(@Param("coachId") coachId: UUID): Long
}

