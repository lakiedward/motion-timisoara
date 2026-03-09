package com.club.triathlon.web.admin

import com.club.triathlon.enums.Role
import com.club.triathlon.security.UserPrincipal
import com.club.triathlon.service.attendance.AdminAttendanceService
import com.club.triathlon.service.attendance.AttendanceMarkRequest
import com.club.triathlon.service.attendance.AttendanceOccurrenceDto
import io.swagger.v3.oas.annotations.Operation
import io.swagger.v3.oas.annotations.security.SecurityRequirement
import org.springframework.format.annotation.DateTimeFormat
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.security.access.prepost.PreAuthorize
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.GetMapping
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
class AdminAttendanceController(
    private val adminAttendanceService: AdminAttendanceService
) {

    @GetMapping
    @Operation(summary = "Get attendance for date", security = [SecurityRequirement(name = "bearerAuth")])
    fun getAttendance(
        @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) date: LocalDate,
        @RequestParam(required = false) coachId: UUID?,
        @AuthenticationPrincipal principal: UserPrincipal
    ): List<AttendanceOccurrenceDto> {
        val user = principal.user
        val effectiveCoachId = when {
            user.role == Role.ADMIN -> coachId // Admin can see all or filter by coach
            user.role == Role.COACH -> user.id // Coach can only see their own
            else -> throw ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied")
        }
        return adminAttendanceService.getAttendanceForDate(date, effectiveCoachId)
    }

    @PostMapping("/mark")
    @Operation(summary = "Mark attendance", security = [SecurityRequirement(name = "bearerAuth")])
    fun markAttendance(
        @RequestBody request: AttendanceMarkRequest,
        @AuthenticationPrincipal principal: UserPrincipal
    ): ResponseEntity<Void> {
        val user = principal.user
        val isAdmin = user.role == Role.ADMIN
        if (user.role != Role.ADMIN && user.role != Role.COACH) {
            throw ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied")
        }
        adminAttendanceService.markAttendance(request, user.id!!, isAdmin)
        return ResponseEntity.noContent().build()
    }
}

