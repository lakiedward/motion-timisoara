package com.club.triathlon.web.attendance

import com.club.triathlon.enums.Role
import com.club.triathlon.security.UserPrincipal
import com.club.triathlon.service.attendance.AttendanceMarkRequest
import com.club.triathlon.service.attendance.AttendanceOccurrenceDto
import com.club.triathlon.service.attendance.CoachAttendanceService
import io.swagger.v3.oas.annotations.Operation
import io.swagger.v3.oas.annotations.security.SecurityRequirement
import org.springframework.http.ResponseEntity
import org.springframework.security.access.prepost.PreAuthorize
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController
import org.springframework.web.server.ResponseStatusException
import org.springframework.http.HttpStatus

@RestController
@RequestMapping("/api/coach/attendance")
@PreAuthorize("hasAnyRole('COACH','ADMIN')")
class CoachAttendanceController(
    private val attendanceService: CoachAttendanceService
) {

    @GetMapping("/today")
    @Operation(summary = "Get today attendance", security = [SecurityRequirement(name = "bearerAuth")])
    fun getToday(@AuthenticationPrincipal principal: UserPrincipal): List<AttendanceOccurrenceDto> {
        val coach = principal.user
        if (coach.role != Role.COACH && coach.role != Role.ADMIN) {
            throw ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied")
        }
        return attendanceService.getTodayAttendance(coach)
    }

    @PostMapping("/mark")
    @Operation(summary = "Mark attendance", security = [SecurityRequirement(name = "bearerAuth")])
    fun markAttendance(
        @AuthenticationPrincipal principal: UserPrincipal,
        @RequestBody request: AttendanceMarkRequest
    ): ResponseEntity<Void> {
        val coach = principal.user
        if (coach.role != Role.COACH && coach.role != Role.ADMIN) {
            throw ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied")
        }
        attendanceService.markAttendance(coach, request)
        return ResponseEntity.noContent().build()
    }
}
