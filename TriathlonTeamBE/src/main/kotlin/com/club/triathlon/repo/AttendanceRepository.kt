package com.club.triathlon.repo

import com.club.triathlon.domain.Attendance
import com.club.triathlon.domain.Child
import com.club.triathlon.domain.CourseOccurrence
import org.springframework.data.jpa.repository.JpaRepository
import java.util.UUID

interface AttendanceRepository : JpaRepository<Attendance, UUID> {
    fun findByOccurrenceAndChild(occurrence: CourseOccurrence, child: Child): Attendance?
    fun findByOccurrenceIn(occurrences: Collection<CourseOccurrence>): List<Attendance>
    fun findByChild(child: Child): List<Attendance>
}
