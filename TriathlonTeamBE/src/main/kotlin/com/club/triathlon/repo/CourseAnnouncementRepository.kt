package com.club.triathlon.repo

import com.club.triathlon.domain.Course
import com.club.triathlon.domain.CourseAnnouncement
import org.springframework.data.domain.Pageable
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import java.util.UUID

interface CourseAnnouncementRepository : JpaRepository<CourseAnnouncement, UUID> {
    fun findByCourseOrderByPinnedDescCreatedAtDesc(course: Course): List<CourseAnnouncement>

    @Query("select a from CourseAnnouncement a where a.course.id = :courseId order by a.pinned desc, a.createdAt desc")
    fun findByCourseIdOrdered(@Param("courseId") courseId: UUID): List<CourseAnnouncement>

    @Query("select a from CourseAnnouncement a where a.course.id in :courseIds order by a.pinned desc, a.createdAt desc")
    fun findByCourseIdsOrdered(@Param("courseIds") courseIds: Collection<UUID>, pageable: Pageable): List<CourseAnnouncement>
}
