package com.club.triathlon.repo

import com.club.triathlon.domain.Course
import com.club.triathlon.domain.CoursePhoto
import org.springframework.data.jpa.repository.JpaRepository
import java.util.UUID

interface CoursePhotoRepository : JpaRepository<CoursePhoto, UUID> {
    fun findByCourseOrderByDisplayOrder(course: Course): List<CoursePhoto>
    fun deleteByCourse(course: Course)
    fun countByCourse(course: Course): Long
}

