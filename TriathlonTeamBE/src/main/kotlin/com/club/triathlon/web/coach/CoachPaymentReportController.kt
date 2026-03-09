package com.club.triathlon.web.coach

import com.club.triathlon.enums.EnrollmentKind
import com.club.triathlon.enums.PaymentMethod
import com.club.triathlon.enums.PaymentStatus
import com.club.triathlon.security.UserPrincipal
import com.club.triathlon.service.payment.PaymentReportRow
import com.club.triathlon.service.payment.PaymentReportService
import io.swagger.v3.oas.annotations.Operation
import io.swagger.v3.oas.annotations.security.SecurityRequirement
import org.springframework.http.HttpStatus
import org.springframework.security.access.prepost.PreAuthorize
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController
import org.springframework.web.server.ResponseStatusException
import java.time.OffsetDateTime
import java.time.format.DateTimeParseException
import java.util.UUID

@RestController
@RequestMapping("/api/coach/payments")
@PreAuthorize("hasAnyRole('COACH','ADMIN')")
class CoachPaymentReportController(
    private val paymentReportService: PaymentReportService
) {

    @GetMapping
    @Operation(summary = "List coach payments", security = [SecurityRequirement(name = "bearerAuth")])
    @Transactional(readOnly = true)
    fun listPayments(
        @AuthenticationPrincipal principal: UserPrincipal,
        @RequestParam(required = false) status: PaymentStatus?,
        @RequestParam(required = false) method: PaymentMethod?,
        @RequestParam(required = false) from: String?,
        @RequestParam(required = false) to: String?
    ): List<PaymentReportRow> {
        val (fromDate, toDate) = parseDateRange(from, to)
        val coachId: UUID? = when (principal.user.role) {
            com.club.triathlon.enums.Role.ADMIN -> null // Admin can list all, for debugging/support
            else -> principal.user.id
        }

        // For coach UI, we only need course payments (attendance sessions are course-based).
        // Enforce kind=COURSE to prevent leaking camp/activity payments in this view.
        return paymentReportService.exportPayments(
            status = status,
            method = method,
            kind = EnrollmentKind.COURSE,
            coachId = coachId,
            from = fromDate,
            to = toDate
        )
    }

    private fun parseDateRange(from: String?, to: String?): Pair<OffsetDateTime?, OffsetDateTime?> {
        val fromDate = from?.let { parseOffset(it) }
        val toDate = to?.let { parseOffset(it) }
        return fromDate to toDate
    }

    private fun parseOffset(value: String): OffsetDateTime {
        return try {
            OffsetDateTime.parse(value)
        } catch (ex: DateTimeParseException) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid date format")
        }
    }
}


