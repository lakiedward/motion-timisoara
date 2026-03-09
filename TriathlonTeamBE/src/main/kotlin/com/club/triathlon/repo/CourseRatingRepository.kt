package com.club.triathlon.repo

import com.club.triathlon.domain.CourseRating
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import java.util.Optional
import java.util.UUID

interface CourseRatingRepository : JpaRepository<CourseRating, UUID> {
    
    fun findByCourseIdAndParentId(courseId: UUID, parentId: UUID): Optional<CourseRating>
    
    fun existsByCourseIdAndParentId(courseId: UUID, parentId: UUID): Boolean
    
    fun findAllByParentId(parentId: UUID): List<CourseRating>
    
    fun findAllByCourseId(courseId: UUID): List<CourseRating>
    
    @Query(
        """
        select coalesce(avg(cr.rating), 0.0) 
        from CourseRating cr 
        where cr.course.id = :courseId
        """
    )
    fun getAverageRatingByCourseId(@Param("courseId") courseId: UUID): Double
    
    @Query(
        """
        select count(cr) 
        from CourseRating cr 
        where cr.course.id = :courseId
        """
    )
    fun countByCourseId(@Param("courseId") courseId: UUID): Long
}

