package com.club.triathlon.web.club

import com.club.triathlon.domain.Club
import com.club.triathlon.repo.ClubRepository
import com.club.triathlon.repo.CourseOccurrenceRepository
import com.club.triathlon.repo.CourseRepository
import com.club.triathlon.security.UserPrincipal
import com.club.triathlon.service.attendance.AdminAttendanceService
import com.club.triathlon.service.attendance.AttendanceMarkRequest
import com.club.triathlon.service.attendance.SessionAttendanceDto
import com.club.triathlon.service.attendance.WeeklyAttendanceService
import com.club.triathlon.service.attendance.WeeklyCalendarDto
import io.swagger.v3.oas.annotations.Operation
import io.swagger.v3.oas.annotations.security.SecurityRequirement
import org.springframework.format.annotation.DateTimeFormat
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.security.access.prepost.PreAuthorize
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController
import org.springframework.web.server.ResponseStatusException
import java.time.LocalDate
import java.util.UUID

@RestController
@RequestMapping("/api/club/attendance")
@PreAuthorize("hasRole('CLUB')")
class ClubAttendanceController(
    private val clubRepository: ClubRepository,
    private val courseRepository: CourseRepository,
    private val courseOccurrenceRepository: CourseOccurrenceRepository,
    private val weeklyAttendanceService: WeeklyAttendanceService,
    private val adminAttendanceService: AdminAttendanceService
) {

    @GetMapping("/weekly")
    @Operation(summary = "Get club weekly calendar", security = [SecurityRequirement(name = "bearerAuth")])
    @Transactional(readOnly = true)
    fun getWeeklyCalendar(
        @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) weekStart: LocalDate,
        @AuthenticationPrincipal principal: UserPrincipal
    ): WeeklyCalendarDto {
        val club = getClubForUser(principal)
        val courseIds = courseRepository.findByClubId(club.id!!).mapNotNull { it.id }
        return weeklyAttendanceService.getWeeklyCalendarForCourses(weekStart, courseIds)
    }

    @GetMapping("/session/{occurrenceId}")
    @Operation(summary = "Get club session attendance details", security = [SecurityRequirement(name = "bearerAuth")])
    @Transactional(readOnly = true)
    fun getSessionAttendance(
        @PathVariable occurrenceId: UUID,
        @AuthenticationPrincipal principal: UserPrincipal
    ): SessionAttendanceDto {
        val club = getClubForUser(principal)
        ensureOccurrenceBelongsToClub(club, occurrenceId)
        return weeklyAttendanceService.getSessionAttendance(occurrenceId)
    }

    @PostMapping("/session/{occurrenceId}/mark")
    @Operation(summary = "Mark attendance for club session", security = [SecurityRequirement(name = "bearerAuth")])
    @Transactional
    fun markSessionAttendance(
        @PathVariable occurrenceId: UUID,
        @RequestBody payload: List<MarkAttendanceItemRequest>,
        @AuthenticationPrincipal principal: UserPrincipal
    ): ResponseEntity<Void> {
        val club = getClubForUser(principal)
        ensureOccurrenceBelongsToClub(club, occurrenceId)

        // Club is allowed to mark attendance for occurrences belonging to its courses.
        // Reuse AdminAttendanceService marking logic (session count validation, enrollment checks).
        payload.forEach { item ->
            val request = AttendanceMarkRequest(
                occurrenceId = occurrenceId,
                childId = item.childId,
                status = item.status,
                note = item.note
            )
            // Pass isAdmin=true to bypass "coach owns occurrence" check; club ownership is enforced above.
            adminAttendanceService.markAttendance(request, principal.user.id!!, true)
        }

        return ResponseEntity.noContent().build()
    }

    private fun getClubForUser(principal: UserPrincipal): Club {
        return clubRepository.findByOwnerId(principal.user.id!!)
            ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "Club not found for this user")
    }

    private fun ensureOccurrenceBelongsToClub(club: Club, occurrenceId: UUID) {
        val occurrence = courseOccurrenceRepository.findById(occurrenceId).orElseThrow {
            ResponseStatusException(HttpStatus.NOT_FOUND, "Occurrence not found")
        }

        val courseClubId = occurrence.course.club?.id
        if (courseClubId == null || courseClubId != club.id) {
            // Return 404 to avoid leaking existence of other occurrences
            throw ResponseStatusException(HttpStatus.NOT_FOUND, "Occurrence not found")
        }
    }
}

data class MarkAttendanceItemRequest(
    val childId: UUID,
    val status: String, // "PRESENT" or "ABSENT"
    val note: String? = null
)


