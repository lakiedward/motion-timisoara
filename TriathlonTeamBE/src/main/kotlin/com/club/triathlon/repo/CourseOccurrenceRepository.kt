package com.club.triathlon.repo

import com.club.triathlon.domain.Course
import com.club.triathlon.domain.CourseOccurrence
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import java.time.OffsetDateTime
import java.util.UUID

interface CourseOccurrenceRepository : JpaRepository<CourseOccurrence, UUID> {
    fun findAllByCourseAndStartsAtAfter(course: Course, startsAt: OffsetDateTime): List<CourseOccurrence>
    
    fun findAllByCourse(course: Course): List<CourseOccurrence>
    
    @Modifying
    fun deleteByCourse(course: Course)

    @Query("select o from CourseOccurrence o where o.course in :courses and o.startsAt > :startsAfter order by o.startsAt asc")
    fun findUpcomingOccurrences(
        @Param("courses") courses: Collection<Course>,
        @Param("startsAfter") startsAfter: OffsetDateTime
    ): List<CourseOccurrence>

    @Query("select o from CourseOccurrence o where o.course.coach.id = :coachId and o.startsAt between :start and :end order by o.startsAt asc")
    fun findForCoachBetween(
        @Param("coachId") coachId: UUID,
        @Param("start") start: OffsetDateTime,
        @Param("end") end: OffsetDateTime
    ): List<CourseOccurrence>

    @Query(
        "select o from CourseOccurrence o where o.course.id in :courseIds and o.startsAt between :start and :end order by o.startsAt asc"
    )
    fun findForCoursesBetween(
        @Param("courseIds") courseIds: Collection<UUID>,
        @Param("start") start: OffsetDateTime,
        @Param("end") end: OffsetDateTime
    ): List<CourseOccurrence>
}
