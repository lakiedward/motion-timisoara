package com.club.triathlon.web.account

import com.club.triathlon.service.parent.ParentCalendarEventDto
import com.club.triathlon.service.parent.ParentDashboardService
import com.club.triathlon.service.parent.ParentOverviewDto
import com.club.triathlon.service.parent.ParentPaymentDto
import io.swagger.v3.oas.annotations.Operation
import io.swagger.v3.oas.annotations.security.SecurityRequirement
import org.springframework.security.access.prepost.PreAuthorize
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController
import java.time.OffsetDateTime

@RestController
@RequestMapping("/api/parent")
@PreAuthorize("hasRole('PARENT')")
class ParentAccountController(
    private val parentDashboardService: ParentDashboardService
) {

    @GetMapping("/overview")
    @Operation(summary = "Parent dashboard overview", security = [SecurityRequirement(name = "bearerAuth")])
    fun getOverview(): ParentOverviewDto = parentDashboardService.getOverview()

    @GetMapping("/payments")
    @Operation(summary = "Parent recent payments", security = [SecurityRequirement(name = "bearerAuth")])
    fun getPayments(@RequestParam(required = false) limit: Int?): List<ParentPaymentDto> =
        parentDashboardService.getPayments(limit)

    @GetMapping("/calendar")
    @Operation(summary = "Parent calendar events", security = [SecurityRequirement(name = "bearerAuth")])
    fun getCalendar(
        @RequestParam startDate: String,
        @RequestParam endDate: String
    ): List<ParentCalendarEventDto> {
        val start = OffsetDateTime.parse(startDate)
        val end = OffsetDateTime.parse(endDate)
        return parentDashboardService.getCalendarEvents(start, end)
    }

    @GetMapping("/upcoming-events")
    @Operation(summary = "Parent upcoming events", security = [SecurityRequirement(name = "bearerAuth")])
    fun getUpcomingEvents(@RequestParam(required = false) limit: Int?): List<ParentCalendarEventDto> =
        parentDashboardService.getUpcomingEvents(limit)
}
