package com.club.triathlon.web.admin

import com.club.triathlon.enums.AttendanceStatus
import com.club.triathlon.enums.Role
import com.club.triathlon.security.UserPrincipal
import com.club.triathlon.service.attendance.SessionAttendanceDto
import com.club.triathlon.service.attendance.WeeklyAttendanceService
import com.club.triathlon.service.attendance.WeeklyCalendarDto
import com.club.triathlon.service.attendance.AttendanceMarkRequest
import com.club.triathlon.service.attendance.AdminAttendanceService
import io.swagger.v3.oas.annotations.Operation
import io.swagger.v3.oas.annotations.security.SecurityRequirement
import org.springframework.format.annotation.DateTimeFormat
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.security.access.prepost.PreAuthorize
import org.springframework.security.core.annotation.AuthenticationPrincipal
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
@RequestMapping("/api/admin/attendance")
@PreAuthorize("hasAnyRole('ADMIN','COACH')")
class WeeklyAttendanceController(
    private val weeklyAttendanceService: WeeklyAttendanceService,
    private val adminAttendanceService: AdminAttendanceService
) {

    @GetMapping("/weekly")
    @Operation(summary = "Get weekly calendar", security = [SecurityRequirement(name = "bearerAuth")])
    fun getWeeklyCalendar(
        @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) weekStart: LocalDate,
        @RequestParam(required = false) coachId: UUID?,
        @AuthenticationPrincipal principal: UserPrincipal
    ): WeeklyCalendarDto {
        val user = principal.user
        val effectiveCoachId = when {
            user.role == Role.ADMIN -> coachId // Admin can see all or filter by coach
            user.role == Role.COACH -> user.id // Coach can only see their own
            else -> throw ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied")
        }
        return weeklyAttendanceService.getWeeklyCalendar(weekStart, effectiveCoachId)
    }

    @GetMapping("/session/{occurrenceId}")
    @Operation(summary = "Get session attendance details", security = [SecurityRequirement(name = "bearerAuth")])
    fun getSessionAttendance(
        @PathVariable occurrenceId: UUID,
        @AuthenticationPrincipal principal: UserPrincipal
    ): SessionAttendanceDto {
        return weeklyAttendanceService.getSessionAttendance(occurrenceId)
    }

    @PostMapping("/session/{occurrenceId}/mark")
    @Operation(summary = "Mark attendance for session", security = [SecurityRequirement(name = "bearerAuth")])
    fun markSessionAttendance(
        @PathVariable occurrenceId: UUID,
        @RequestBody payload: List<MarkAttendanceItemRequest>,
        @AuthenticationPrincipal principal: UserPrincipal
    ): ResponseEntity<Void> {
        val user = principal.user
        val isAdmin = user.role == Role.ADMIN

        // Mark attendance for each child
        payload.forEach { item ->
            val request = AttendanceMarkRequest(
                occurrenceId = occurrenceId,
                childId = item.childId,
                status = item.status,
                note = item.note
            )
            adminAttendanceService.markAttendance(request, user.id!!, isAdmin)
        }

        return ResponseEntity.noContent().build()
    }
}

data class MarkAttendanceItemRequest(
    val childId: UUID,
    val status: String, // "PRESENT" or "ABSENT"
    val note: String? = null
)

