package com.club.triathlon.service.course

import com.club.triathlon.domain.Course
import com.club.triathlon.domain.CourseOccurrence
import com.club.triathlon.repo.AttendanceRepository
import com.club.triathlon.repo.CourseOccurrenceRepository
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.LocalDate
import java.time.OffsetDateTime
import java.time.ZoneId

@Service
class CourseSchedulerService(
    private val courseOccurrenceRepository: CourseOccurrenceRepository,
    private val attendanceRepository: AttendanceRepository,
    @Value("\${app.time-zone:Europe/Bucharest}") private val appTimeZone: String?
) {
    private val logger = LoggerFactory.getLogger(CourseSchedulerService::class.java)

    @Transactional
    fun regenerateOccurrences(course: Course, rule: RecurrenceRule, zoneId: ZoneId = resolveZoneId()) {
        val now = OffsetDateTime.now(zoneId)
        val futureOccurrences = courseOccurrenceRepository.findAllByCourseAndStartsAtAfter(course, now)
        
        // Check which occurrences have attendance records
        val attendanceRecords = if (futureOccurrences.isNotEmpty()) {
            attendanceRepository.findByOccurrenceIn(futureOccurrences)
        } else {
            emptyList()
        }
        val occurrencesWithAttendance = attendanceRecords.map { it.occurrence.id }.toSet()
        
        // Only delete occurrences without attendance records
        val occurrencesToDelete = futureOccurrences.filter { it.id !in occurrencesWithAttendance }
        
        if (occurrencesToDelete.isNotEmpty()) {
            logger.info("🗑️ [SCHEDULER] Deleting ${occurrencesToDelete.size} future occurrences without attendance for course: ${course.name}")
            courseOccurrenceRepository.deleteAll(occurrencesToDelete)
        }
        
        if (occurrencesWithAttendance.isNotEmpty()) {
            logger.info("⚠️ [SCHEDULER] Keeping ${occurrencesWithAttendance.size} occurrences with attendance records for course: ${course.name}")
        }

        val startDate = LocalDate.now(zoneId)
        val endDate = startDate.plusWeeks(8)
        val occurrences = mutableListOf<CourseOccurrence>()

        var date = startDate
        while (!date.isAfter(endDate)) {
            val dayOfWeek = date.dayOfWeek.value
            val timeSlot = rule.getTimeSlot(dayOfWeek)
            
            if (timeSlot != null) {
                val startDateTime = date.atTime(timeSlot.start).atZone(zoneId).toOffsetDateTime()
                val endDateTime = date.atTime(timeSlot.end).atZone(zoneId).toOffsetDateTime()
                if (endDateTime.isAfter(now)) {
                    val occurrence = CourseOccurrence().apply {
                        this.course = course
                        this.startsAt = startDateTime
                        this.endsAt = endDateTime
                    }
                    occurrences += occurrence
                }
            }
            date = date.plusDays(1)
        }

        courseOccurrenceRepository.saveAll(occurrences)
    }

    private fun resolveZoneId(): ZoneId {
        val configured = appTimeZone?.trim().orEmpty()
        // Prefer configured value if valid, else fallback to Europe/Bucharest, else system default
        return try {
            if (configured.isNotEmpty()) ZoneId.of(configured) else ZoneId.of("Europe/Bucharest")
        } catch (_: Exception) {
            try {
                ZoneId.of("Europe/Bucharest")
            } catch (_: Exception) {
                ZoneId.systemDefault()
            }
        }
    }
}