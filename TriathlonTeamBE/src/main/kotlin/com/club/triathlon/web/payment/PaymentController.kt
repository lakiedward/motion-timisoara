package com.club.triathlon.web.payment

import com.club.triathlon.enums.Role
import com.club.triathlon.security.UserPrincipal
import com.club.triathlon.service.enrollment.EnrollmentService
import com.club.triathlon.service.payment.PaymentIntentResponse
import com.club.triathlon.service.payment.PaymentService
import io.swagger.v3.oas.annotations.Operation
import io.swagger.v3.oas.annotations.security.SecurityRequirement
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.security.access.prepost.PreAuthorize
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PatchMapping
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController
import org.springframework.web.server.ResponseStatusException
import java.util.UUID
import jakarta.validation.Valid

@RestController
@RequestMapping
class PaymentController(
    private val paymentService: PaymentService,
    private val enrollmentService: EnrollmentService
) {

    @PostMapping("/api/payments/create-intent")
    @Operation(summary = "Create payment intent", security = [SecurityRequirement(name = "bearerAuth")])
    @PreAuthorize("hasAnyRole('PARENT','ADMIN')")
    fun createIntent(
        @AuthenticationPrincipal principal: UserPrincipal,
        @jakarta.validation.Valid @RequestBody request: PaymentIntentRequest
    ): PaymentIntentResponse {
        val enrollment = enrollmentService.getEnrollmentById(request.enrollmentId)
        val user = principal.user
        if (user.role == Role.PARENT && enrollment.child.parent.id != user.id) {
            throw ResponseStatusException(HttpStatus.FORBIDDEN, "Cannot access enrollment")
        }
        return paymentService.createPaymentIntent(request.enrollmentId)
    }

    @PatchMapping("/api/admin/payments/{paymentId}/mark-cash-paid")
    @Operation(summary = "Mark cash payment", security = [SecurityRequirement(name = "bearerAuth")])
    @PreAuthorize("hasRole('ADMIN')")
    fun markCashPaid(@PathVariable paymentId: UUID): ResponseEntity<Void> {
        paymentService.markCashPaid(paymentId)
        return ResponseEntity.noContent().build()
    }

    @PatchMapping("/api/coach/payments/{paymentId}/mark-cash-paid")
    @Operation(summary = "Coach mark cash payment", security = [SecurityRequirement(name = "bearerAuth")])
    @PreAuthorize("hasAnyRole('COACH','ADMIN')")
    fun coachMarkCashPaid(
        @PathVariable paymentId: UUID,
        @AuthenticationPrincipal principal: UserPrincipal
    ): ResponseEntity<Void> {
        val user = principal.user
        if (user.role == Role.ADMIN) {
            paymentService.markCashPaid(paymentId)
        } else {
            paymentService.markCashPaidByCoach(paymentId, user.id!!)
        }
        return ResponseEntity.noContent().build()
    }
}

data class PaymentIntentRequest(val enrollmentId: UUID)

