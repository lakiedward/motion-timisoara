package com.club.triathlon.web.enrollment

import com.club.triathlon.service.enrollment.SessionPurchaseRequest
import com.club.triathlon.service.enrollment.SessionPurchaseResponse
import com.club.triathlon.service.enrollment.SessionPurchaseService
import com.club.triathlon.enums.PaymentMethod
import com.club.triathlon.security.UserPrincipal
import io.swagger.v3.oas.annotations.Operation
import io.swagger.v3.oas.annotations.security.SecurityRequirement
import org.springframework.http.ResponseEntity
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.*
import java.util.UUID

@RestController
@RequestMapping("/api/enrollments")
class SessionPurchaseController(
    private val sessionPurchaseService: SessionPurchaseService
) {

    @PostMapping("/{enrollmentId}/purchase-sessions")
    @Operation(
        summary = "Purchase additional sessions for an enrollment",
        security = [SecurityRequirement(name = "bearerAuth")]
    )
    fun purchaseAdditionalSessions(
        @PathVariable enrollmentId: UUID,
        @RequestBody payload: SessionPurchasePayload,
        @AuthenticationPrincipal principal: UserPrincipal
    ): ResponseEntity<SessionPurchaseResponse> {
        val request = SessionPurchaseRequest(
            enrollmentId = enrollmentId,
            sessionCount = payload.sessionCount,
            paymentMethod = payload.paymentMethod
        )
        val response = sessionPurchaseService.purchaseAdditionalSessions(request, principal.user)
        return ResponseEntity.ok(response)
    }
}

data class SessionPurchasePayload(
    val sessionCount: Int,
    val paymentMethod: PaymentMethod
)

