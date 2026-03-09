package com.club.triathlon.web.admin

import com.club.triathlon.enums.Role
import com.club.triathlon.security.UserPrincipal
import com.club.triathlon.service.payment.MonthlyPaymentService
import io.swagger.v3.oas.annotations.Operation
import io.swagger.v3.oas.annotations.security.SecurityRequirement
import org.springframework.http.ResponseEntity
import org.springframework.security.access.prepost.PreAuthorize
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.PatchMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController
import java.util.UUID

@RestController
@RequestMapping("/api/coach/monthly-payments")
@PreAuthorize("hasAnyRole('COACH','ADMIN')")
class MonthlyPaymentController(
    private val monthlyPaymentService: MonthlyPaymentService
) {

    @PatchMapping("/{paymentId}/mark-paid")
    @Operation(summary = "Mark monthly payment as paid", security = [SecurityRequirement(name = "bearerAuth")])
    fun markMonthlyPaid(
        @PathVariable paymentId: UUID,
        @AuthenticationPrincipal principal: UserPrincipal
    ): ResponseEntity<Void> {
        val user = principal.user
        val coachId = if (user.role == Role.ADMIN) null else user.id

        monthlyPaymentService.markMonthlyPaymentPaid(paymentId, coachId)
        return ResponseEntity.noContent().build()
    }

    @PatchMapping("/{paymentId}/unmark")
    @Operation(summary = "Unmark monthly payment (set to pending)", security = [SecurityRequirement(name = "bearerAuth")])
    fun unmarkMonthlyPayment(
        @PathVariable paymentId: UUID,
        @AuthenticationPrincipal principal: UserPrincipal
    ): ResponseEntity<Void> {
        val user = principal.user
        val coachId = if (user.role == Role.ADMIN) null else user.id

        monthlyPaymentService.unmarkMonthlyPayment(paymentId, coachId)
        return ResponseEntity.noContent().build()
    }
}

