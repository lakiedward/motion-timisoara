package com.club.triathlon.service.attendance

import com.club.triathlon.domain.Attendance
import com.club.triathlon.enums.AttendanceStatus
import com.club.triathlon.enums.EnrollmentKind
import com.club.triathlon.enums.EnrollmentStatus
import com.club.triathlon.repo.AttendanceRepository
import com.club.triathlon.repo.ChildRepository
import com.club.triathlon.repo.CourseOccurrenceRepository
import com.club.triathlon.repo.EnrollmentRepository
import org.springframework.http.HttpStatus
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.server.ResponseStatusException
import java.time.LocalDate
import java.time.ZoneId
import java.util.UUID

@Service
class AdminAttendanceService(
    private val courseOccurrenceRepository: CourseOccurrenceRepository,
    private val enrollmentRepository: EnrollmentRepository,
    private val attendanceRepository: AttendanceRepository,
    private val childRepository: ChildRepository
) {

    @Transactional(readOnly = true)
    fun getAttendanceForDate(date: LocalDate, coachId: UUID?, zoneId: ZoneId = ZoneId.systemDefault()): List<AttendanceOccurrenceDto> {
        val startOfDay = date.atStartOfDay(zoneId).toOffsetDateTime()
        val endOfDay = date.plusDays(1).atStartOfDay(zoneId).minusNanos(1).toOffsetDateTime()
        
        val occurrences = if (coachId != null) {
            courseOccurrenceRepository.findForCoachBetween(coachId, startOfDay, endOfDay)
        } else {
            // Query all occurrences for the date range
            courseOccurrenceRepository.findAll().filter {
                it.startsAt >= startOfDay && it.startsAt <= endOfDay
            }
        }
        
        if (occurrences.isEmpty()) return emptyList()

        val courseIds = occurrences.map { it.course.id!! }.distinct()
        val enrollments = enrollmentRepository.findByKindAndEntityIdInAndStatusIn(
            EnrollmentKind.COURSE,
            courseIds,
            listOf(EnrollmentStatus.ACTIVE, EnrollmentStatus.PENDING)
        )
        val enrollmentsByCourse = enrollments.groupBy { it.entityId }
        val attendances = attendanceRepository.findByOccurrenceIn(occurrences)
            .associateBy { it.occurrence.id to it.child.id }

        return occurrences.map { occurrence ->
            val course = occurrence.course
            val children = enrollmentsByCourse[course.id]?.map { enrollment ->
                val attendance = attendances[occurrence.id to enrollment.child.id]
                AttendanceChildDto(
                    childId = enrollment.child.id!!,
                    childName = enrollment.child.name,
                    status = attendance?.status,
                    note = attendance?.note
                )
            } ?: emptyList()
            AttendanceOccurrenceDto(
                occurrenceId = occurrence.id!!,
                courseId = course.id!!,
                courseName = course.name,
                startsAt = occurrence.startsAt,
                endsAt = occurrence.endsAt,
                children = children
            )
        }
    }

    @Transactional
    fun markAttendance(request: AttendanceMarkRequest, actingUserId: UUID, isAdmin: Boolean) {
        val occurrence = courseOccurrenceRepository.findById(request.occurrenceId).orElseThrow {
            ResponseStatusException(HttpStatus.NOT_FOUND, "Occurrence not found")
        }
        
        // If not admin, verify the occurrence belongs to the acting user (coach)
        if (!isAdmin && occurrence.course.coach.id != actingUserId) {
            throw ResponseStatusException(HttpStatus.FORBIDDEN, "Not allowed to mark this occurrence")
        }
        
        val child = childRepository.findById(request.childId).orElseThrow {
            ResponseStatusException(HttpStatus.NOT_FOUND, "Child not found")
        }
        
        val enrollment = enrollmentRepository.findByKindAndEntityIdAndChildAndStatusIn(
            EnrollmentKind.COURSE,
            occurrence.course.id!!,
            child,
            listOf(EnrollmentStatus.ACTIVE, EnrollmentStatus.PENDING)
        ).firstOrNull() ?: throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Child not enrolled for this course")
        
        val status = AttendanceStatus.valueOf(request.status)
        val existingAttendance = attendanceRepository.findByOccurrenceAndChild(occurrence, child)
        val previousStatus = existingAttendance?.status
        val attendance = existingAttendance ?: Attendance().apply {
            this.occurrence = occurrence
            this.child = child
        }

        if (status == AttendanceStatus.PRESENT && previousStatus != AttendanceStatus.PRESENT) {
            if (enrollment.remainingSessions <= 0) {
                throw ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "No remaining sessions available for ${child.name}. Please add more sessions or use a different payment package."
                )
            }
        }

        attendance.status = status
        attendance.note = request.note
        attendanceRepository.save(attendance)
        
        // Update session count if marking as PRESENT (and wasn't PRESENT before)
        if (status == AttendanceStatus.PRESENT &&
            previousStatus != AttendanceStatus.PRESENT) {
            enrollment.remainingSessions = (enrollment.remainingSessions - 1).coerceAtLeast(0)
            enrollment.sessionsUsed += 1
            enrollmentRepository.save(enrollment)
        }
        // If changing FROM PRESENT to something else, restore the session
        else if (previousStatus == AttendanceStatus.PRESENT &&
                 status != AttendanceStatus.PRESENT) {
            enrollment.remainingSessions += 1
            enrollment.sessionsUsed = (enrollment.sessionsUsed - 1).coerceAtLeast(0)
            enrollmentRepository.save(enrollment)
        }
    }
}

