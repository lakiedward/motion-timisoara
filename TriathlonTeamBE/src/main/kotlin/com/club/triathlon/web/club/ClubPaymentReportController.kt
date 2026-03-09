package com.club.triathlon.web.club

import com.club.triathlon.domain.Club
import com.club.triathlon.enums.EnrollmentKind
import com.club.triathlon.enums.PaymentMethod
import com.club.triathlon.enums.PaymentStatus
import com.club.triathlon.repo.ClubRepository
import com.club.triathlon.repo.CourseRepository
import com.club.triathlon.repo.PaymentRepository
import com.club.triathlon.security.UserPrincipal
import com.club.triathlon.service.payment.PaymentReportRow
import com.club.triathlon.service.payment.PaymentService
import io.swagger.v3.oas.annotations.Operation
import io.swagger.v3.oas.annotations.security.SecurityRequirement
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.security.access.prepost.PreAuthorize
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PatchMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController
import org.springframework.web.server.ResponseStatusException
import java.util.UUID

@RestController
@RequestMapping("/api/club/payments")
@PreAuthorize("hasRole('CLUB')")
class ClubPaymentReportController(
    private val clubRepository: ClubRepository,
    private val paymentRepository: PaymentRepository,
    private val courseRepository: CourseRepository,
    private val paymentService: PaymentService
) {

    @GetMapping
    @Operation(summary = "List club payments", security = [SecurityRequirement(name = "bearerAuth")])
    @Transactional(readOnly = true)
    fun listPendingCashPayments(@AuthenticationPrincipal principal: UserPrincipal): List<PaymentReportRow> {
        val club = getClubForUser(principal)
        // Club UI needs only pending CASH payments for club courses
        return paymentRepository.findClubPaymentReports(club.id!!, PaymentStatus.PENDING, PaymentMethod.CASH)
    }

    @PatchMapping("/{paymentId}/mark-cash-paid")
    @Operation(summary = "Club mark cash payment", security = [SecurityRequirement(name = "bearerAuth")])
    @Transactional
    fun clubMarkCashPaid(
        @PathVariable paymentId: UUID,
        @AuthenticationPrincipal principal: UserPrincipal
    ): ResponseEntity<Void> {
        val club = getClubForUser(principal)

        val payment = paymentRepository.findById(paymentId).orElseThrow {
            ResponseStatusException(HttpStatus.NOT_FOUND, "Payment not found")
        }

        val enrollment = payment.enrollment
        if (enrollment.kind != EnrollmentKind.COURSE) {
            // Hide existence of other kinds (camp/activity) from club endpoint
            throw ResponseStatusException(HttpStatus.NOT_FOUND, "Payment not found")
        }

        val course = courseRepository.findById(enrollment.entityId).orElseThrow {
            ResponseStatusException(HttpStatus.NOT_FOUND, "Payment not found")
        }

        val courseClubId = course.club?.id
        if (courseClubId == null || courseClubId != club.id) {
            // 404 to avoid leaking existence of other payments
            throw ResponseStatusException(HttpStatus.NOT_FOUND, "Payment not found")
        }

        paymentService.markCashPaid(paymentId)
        return ResponseEntity.noContent().build()
    }

    private fun getClubForUser(principal: UserPrincipal): Club {
        return clubRepository.findByOwnerId(principal.user.id!!)
            ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "Club not found for this user")
    }
}


