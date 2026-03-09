package com.club.triathlon.web.admin

import com.club.triathlon.enums.EnrollmentKind
import com.club.triathlon.enums.PaymentMethod
import com.club.triathlon.enums.PaymentStatus
import com.club.triathlon.service.payment.PaymentReportRow
import com.club.triathlon.service.payment.PaymentReportService
import io.swagger.v3.oas.annotations.Operation
import io.swagger.v3.oas.annotations.security.SecurityRequirement
import org.springframework.data.domain.Page
import org.springframework.http.HttpHeaders
import org.springframework.http.MediaType
import org.springframework.http.ResponseEntity
import org.springframework.security.access.prepost.PreAuthorize
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController
import java.time.OffsetDateTime
import java.time.format.DateTimeParseException
import java.util.UUID

@RestController
@RequestMapping("/api/admin/payments")
@PreAuthorize("hasRole('ADMIN')")
class AdminPaymentReportController(
    private val paymentReportService: PaymentReportService
) {

    @GetMapping
    @Operation(summary = "List payments", security = [SecurityRequirement(name = "bearerAuth")])
    fun listPayments(
        @RequestParam(required = false) status: PaymentStatus?,
        @RequestParam(required = false) method: PaymentMethod?,
        @RequestParam(required = false) kind: EnrollmentKind?,
        @RequestParam(required = false) coachId: UUID?,
        @RequestParam(required = false) from: String?,
        @RequestParam(required = false) to: String?
    ): List<PaymentReportRow> {
        val (fromDate, toDate) = parseDateRange(from, to)
        // Return all payments without pagination for the admin payments confirmation page
        return paymentReportService.exportPayments(status, method, kind, coachId, fromDate, toDate)
    }

    @GetMapping("/export.csv")
    @Operation(summary = "Export payments", security = [SecurityRequirement(name = "bearerAuth")])
    fun exportCsv(
        @RequestParam(required = false) status: PaymentStatus?,
        @RequestParam(required = false) method: PaymentMethod?,
        @RequestParam(required = false) kind: EnrollmentKind?,
        @RequestParam(required = false) coachId: UUID?,
        @RequestParam(required = false) from: String?,
        @RequestParam(required = false) to: String?
    ): ResponseEntity<String> {
        val (fromDate, toDate) = parseDateRange(from, to)
        val rows = paymentReportService.exportPayments(status, method, kind, coachId, fromDate, toDate)
        val csv = paymentReportService.toCsv(rows)
        return ResponseEntity.ok()
            .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=payments.csv")
            .contentType(MediaType.parseMediaType("text/csv"))
            .body(csv)
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
            throw org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.BAD_REQUEST, "Invalid date format")
        }
    }
}
