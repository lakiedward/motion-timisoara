package com.club.triathlon.service.attendance

import com.club.triathlon.domain.Attendance
import com.club.triathlon.domain.CourseOccurrence
import com.club.triathlon.domain.User
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
import java.time.OffsetDateTime
import java.time.ZoneId
import java.util.UUID

@Service
class CoachAttendanceService(
    private val courseOccurrenceRepository: CourseOccurrenceRepository,
    private val enrollmentRepository: EnrollmentRepository,
    private val attendanceRepository: AttendanceRepository,
    private val childRepository: ChildRepository
) {

    @Transactional(readOnly = true)
    fun getTodayAttendance(coach: User, zoneId: ZoneId = ZoneId.systemDefault()): List<AttendanceOccurrenceDto> {
        val today = LocalDate.now(zoneId)
        val startOfDay = today.atStartOfDay(zoneId).toOffsetDateTime()
        val endOfDay = today.plusDays(1).atStartOfDay(zoneId).minusNanos(1).toOffsetDateTime()
        val occurrences = courseOccurrenceRepository.findForCoachBetween(coach.id!!, startOfDay, endOfDay)
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
    fun markAttendance(coach: User, request: AttendanceMarkRequest) {
        val occurrence = courseOccurrenceRepository.findById(request.occurrenceId).orElseThrow {
            ResponseStatusException(HttpStatus.NOT_FOUND, "Occurrence not found")
        }
        if (occurrence.course.coach.id != coach.id) {
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
        val attendance = attendanceRepository.findByOccurrenceAndChild(occurrence, child)
            ?: Attendance().apply {
                this.occurrence = occurrence
                this.child = child
            }
        
        val previousStatus = attendance.status
        
        // Validate session availability BEFORE marking as PRESENT
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
        if (status == AttendanceStatus.PRESENT && previousStatus != AttendanceStatus.PRESENT) {
            enrollment.remainingSessions -= 1
            enrollment.sessionsUsed += 1
            enrollmentRepository.save(enrollment)
        }
        // If changing FROM PRESENT to something else, restore the session (symmetric)
        else if (previousStatus == AttendanceStatus.PRESENT && status != AttendanceStatus.PRESENT) {
            enrollment.remainingSessions += 1
            enrollment.sessionsUsed -= 1
            enrollmentRepository.save(enrollment)
        }
    }
}

data class AttendanceOccurrenceDto(
    val occurrenceId: UUID,
    val courseId: UUID,
    val courseName: String,
    val startsAt: OffsetDateTime,
    val endsAt: OffsetDateTime,
    val children: List<AttendanceChildDto>
)

data class AttendanceChildDto(
    val childId: UUID,
    val childName: String,
    val status: AttendanceStatus?,
    val note: String?
)

data class AttendanceMarkRequest(
    val occurrenceId: UUID,
    val childId: UUID,
    val status: String,
    val note: String?
)