package com.club.triathlon.service.attendance

import com.club.triathlon.domain.CourseOccurrence
import com.club.triathlon.enums.AttendanceStatus
import com.club.triathlon.enums.EnrollmentKind
import com.club.triathlon.enums.EnrollmentStatus
import com.club.triathlon.enums.PaymentMethod
import com.club.triathlon.repo.AttendanceRepository
import com.club.triathlon.repo.CourseOccurrenceRepository
import com.club.triathlon.repo.CourseRepository
import com.club.triathlon.repo.EnrollmentRepository
import com.club.triathlon.repo.UserRepository
import com.club.triathlon.service.payment.MonthlyPaymentService
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.DayOfWeek
import java.time.LocalDate
import java.time.OffsetDateTime
import java.time.ZoneId
import java.time.format.TextStyle
import java.util.Locale
import java.util.UUID

@Service
class WeeklyAttendanceService(
    private val courseOccurrenceRepository: CourseOccurrenceRepository,
    private val enrollmentRepository: EnrollmentRepository,
    private val attendanceRepository: AttendanceRepository,
    private val courseRepository: CourseRepository,
    private val userRepository: UserRepository,
    private val monthlyPaymentService: MonthlyPaymentService
) {

    private data class WeekRange(
        val startOfWeek: LocalDate,
        val endOfWeek: LocalDate,
        val startDateTime: OffsetDateTime,
        val endDateTime: OffsetDateTime
    )

    private fun computeWeekRange(weekStart: LocalDate, zoneId: ZoneId): WeekRange {
        val startOfWeek = weekStart.with(DayOfWeek.MONDAY)
        val endOfWeek = startOfWeek.plusDays(6) // Sunday

        val startDateTime = startOfWeek.atStartOfDay(zoneId).toOffsetDateTime()
        val endDateTime = endOfWeek.plusDays(1).atStartOfDay(zoneId).minusNanos(1).toOffsetDateTime()

        return WeekRange(
            startOfWeek = startOfWeek,
            endOfWeek = endOfWeek,
            startDateTime = startDateTime,
            endDateTime = endDateTime
        )
    }

    private fun buildWeeklyCalendar(startOfWeek: LocalDate, occurrences: List<CourseOccurrence>): List<CoachWeekDto> {
        // Group by coach
        val occurrencesByCoach = occurrences.groupBy { it.course.coach }

        return occurrencesByCoach.map { (coach, coachOccurrences) ->
            // Group by day
            val occurrencesByDay = coachOccurrences.groupBy { it.startsAt.toLocalDate() }

            val days = (0..6).map { dayOffset ->
                val date = startOfWeek.plusDays(dayOffset.toLong())
                val dayOccurrences = occurrencesByDay[date] ?: emptyList()

                // Get enrollment counts for each occurrence
                val sessions = dayOccurrences.map { occurrence ->
                    val courseId = occurrence.course.id!!
                    val enrolledCount = enrollmentRepository.countByKindAndEntityIdAndStatusIn(
                        EnrollmentKind.COURSE,
                        courseId,
                        listOf(EnrollmentStatus.ACTIVE, EnrollmentStatus.PENDING)
                    )

                    SessionSummaryDto(
                        occurrenceId = occurrence.id!!,
                        courseId = courseId,
                        courseName = occurrence.course.name,
                        startsAt = occurrence.startsAt,
                        endsAt = occurrence.endsAt,
                        enrolledCount = enrolledCount.toInt()
                    )
                }

                DaySessionsDto(
                    date = date,
                    dayOfWeek = date.dayOfWeek.getDisplayName(TextStyle.SHORT, Locale.forLanguageTag("ro")),
                    sessions = sessions
                )
            }

            CoachWeekDto(
                coachId = coach.id!!,
                coachName = coach.name,
                days = days
            )
        }
    }

    @Transactional(readOnly = true)
    fun getWeeklyCalendar(weekStart: LocalDate, coachId: UUID?, zoneId: ZoneId = ZoneId.systemDefault()): WeeklyCalendarDto {
        val range = computeWeekRange(weekStart, zoneId)

        // Get all occurrences for the week
        val occurrences = if (coachId != null) {
            courseOccurrenceRepository.findForCoachBetween(coachId, range.startDateTime, range.endDateTime)
        } else {
            courseOccurrenceRepository.findAll().filter {
                it.startsAt >= range.startDateTime && it.startsAt <= range.endDateTime
            }
        }

        return WeeklyCalendarDto(
            weekStart = range.startOfWeek,
            weekEnd = range.endOfWeek,
            coaches = buildWeeklyCalendar(range.startOfWeek, occurrences)
        )
    }

    @Transactional(readOnly = true)
    fun getWeeklyCalendarForCourses(
        weekStart: LocalDate,
        courseIds: Collection<UUID>,
        zoneId: ZoneId = ZoneId.systemDefault()
    ): WeeklyCalendarDto {
        val range = computeWeekRange(weekStart, zoneId)

        if (courseIds.isEmpty()) {
            return WeeklyCalendarDto(
                weekStart = range.startOfWeek,
                weekEnd = range.endOfWeek,
                coaches = emptyList()
            )
        }

        val occurrences = courseOccurrenceRepository.findForCoursesBetween(courseIds, range.startDateTime, range.endDateTime)

        return WeeklyCalendarDto(
            weekStart = range.startOfWeek,
            weekEnd = range.endOfWeek,
            coaches = buildWeeklyCalendar(range.startOfWeek, occurrences)
        )
    }

    @Transactional(readOnly = true)
    fun getSessionAttendance(occurrenceId: UUID): SessionAttendanceDto {
        val occurrence = courseOccurrenceRepository.findById(occurrenceId).orElseThrow {
            throw IllegalArgumentException("Occurrence not found")
        }

        val course = occurrence.course
        val courseId = course.id!!

        // Get all enrollments for this course
        val enrollments = enrollmentRepository.findByKindAndEntityId(EnrollmentKind.COURSE, courseId)
            .filter { it.status == EnrollmentStatus.ACTIVE || it.status == EnrollmentStatus.PENDING }

        // Get existing attendance records
        val attendances = attendanceRepository.findByOccurrenceIn(listOf(occurrence))
            .associateBy { it.child.id }

        // Build children list with session status
        val children = enrollments.map { enrollment ->
            val child = enrollment.child
            val attendance = attendances[child.id]

            ChildAttendancePaymentDto(
                enrollmentId = enrollment.id!!,
                childId = child.id!!,
                childName = child.name,
                attendanceStatus = attendance?.status,
                remainingSessions = enrollment.remainingSessions,
                sessionsUsed = enrollment.sessionsUsed,
                lowSessionWarning = enrollment.remainingSessions <= 3
            )
        }

        return SessionAttendanceDto(
            occurrenceId = occurrence.id!!,
            courseName = course.name,
            startsAt = occurrence.startsAt,
            children = children
        )
    }
}

// DTOs
data class WeeklyCalendarDto(
    val weekStart: LocalDate,
    val weekEnd: LocalDate,
    val coaches: List<CoachWeekDto>
)

data class CoachWeekDto(
    val coachId: UUID,
    val coachName: String,
    val days: List<DaySessionsDto>
)

data class DaySessionsDto(
    val date: LocalDate,
    val dayOfWeek: String,
    val sessions: List<SessionSummaryDto>
)

data class SessionSummaryDto(
    val occurrenceId: UUID,
    val courseId: UUID,
    val courseName: String,
    val startsAt: OffsetDateTime,
    val endsAt: OffsetDateTime,
    val enrolledCount: Int
)

data class SessionAttendanceDto(
    val occurrenceId: UUID,
    val courseName: String,
    val startsAt: OffsetDateTime,
    val children: List<ChildAttendancePaymentDto>
)

data class ChildAttendancePaymentDto(
    val enrollmentId: UUID,
    val childId: UUID,
    val childName: String,
    val attendanceStatus: AttendanceStatus?,
    val remainingSessions: Int,
    val sessionsUsed: Int,
    val lowSessionWarning: Boolean
)

