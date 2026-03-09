package com.club.triathlon.service.enrollment

import com.club.triathlon.domain.Payment
import com.club.triathlon.domain.User
import com.club.triathlon.enums.EnrollmentKind
import com.club.triathlon.enums.PaymentMethod
import com.club.triathlon.enums.PaymentStatus
import com.club.triathlon.enums.Role
import com.club.triathlon.repo.CourseRepository
import com.club.triathlon.repo.EnrollmentRepository
import com.club.triathlon.repo.PaymentRepository
import org.springframework.http.HttpStatus
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.server.ResponseStatusException
import java.math.BigDecimal
import java.time.OffsetDateTime
import java.util.UUID

@Service
class SessionPurchaseService(
    private val webSocketNotificationService: com.club.triathlon.service.notification.WebSocketNotificationService,
    private val enrollmentRepository: EnrollmentRepository,
    private val courseRepository: CourseRepository,
    private val paymentRepository: PaymentRepository
) {

    @Transactional
    fun purchaseAdditionalSessions(request: SessionPurchaseRequest, actor: User): SessionPurchaseResponse {
        val actorId = actor.id
            ?: throw ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not authenticated")

        val enrollment = enrollmentRepository.findById(request.enrollmentId).orElseThrow {
            ResponseStatusException(HttpStatus.NOT_FOUND, "Enrollment not found")
        }

        if (enrollment.kind != EnrollmentKind.COURSE) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Only course enrollments can purchase sessions")
        }

        val course = courseRepository.findById(enrollment.entityId).orElseThrow {
            ResponseStatusException(HttpStatus.NOT_FOUND, "Course not found")
        }

        // Authorization: limit who can top up sessions for an enrollment
        when (actor.role) {
            Role.ADMIN -> {
                // Admin can purchase sessions for any enrollment
            }
            Role.COACH -> {
                if (course.coach.id != actorId) {
                    throw ResponseStatusException(HttpStatus.FORBIDDEN, "Not allowed to purchase sessions for this enrollment")
                }
            }
            Role.PARENT -> {
                if (enrollment.child.parent.id != actorId) {
                    throw ResponseStatusException(HttpStatus.FORBIDDEN, "Not allowed to purchase sessions for this enrollment")
                }
            }
            Role.CLUB -> {
                val ownerId = course.club?.owner?.id
                if (ownerId == null || ownerId != actorId) {
                    throw ResponseStatusException(HttpStatus.FORBIDDEN, "Not allowed to purchase sessions for this enrollment")
                }
            }
        }

        if (request.sessionCount < 1) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Session count must be at least 1")
        }

        // Calculate total price
        val totalPrice = course.pricePerSession * request.sessionCount

        // For CARD payments, update enrollment immediately (will be pending until Stripe confirms)
        // For CASH payments, DO NOT update enrollment - wait for coach confirmation
        if (request.paymentMethod == PaymentMethod.CARD) {
            enrollment.purchasedSessions += request.sessionCount
            enrollment.remainingSessions += request.sessionCount
            enrollmentRepository.save(enrollment)
        }

        // Create payment record
        val requiresPaymentIntent = request.paymentMethod == PaymentMethod.CARD
        val now = OffsetDateTime.now()
        val payment = Payment().apply {
            this.enrollment = enrollment
            method = request.paymentMethod
            amount = totalPrice
            currency = course.currency
            // Both CASH and CARD payments start as PENDING
            // CASH: coach must confirm via /api/coach/payments/{id}/mark-cash-paid
            // CARD: Stripe webhook confirms payment
            status = PaymentStatus.PENDING
            createdAt = now
            updatedAt = now
        }
        paymentRepository.save(payment)

        // For CASH payments, notify coach that payment is pending confirmation
        if (request.paymentMethod == PaymentMethod.CASH) {
            webSocketNotificationService.notifyPendingCashPayment(
                enrollment.id!!,
                payment.id!!,
                request.sessionCount,
                course.id!!
            )
        }

        return SessionPurchaseResponse(
            enrollmentId = enrollment.id!!,
            sessionsPurchased = request.sessionCount,
            totalPrice = totalPrice,
            newRemainingBalance = enrollment.remainingSessions,
            requiresPaymentIntent = requiresPaymentIntent
        )
    }
}

data class SessionPurchaseRequest(
    val enrollmentId: UUID,
    val sessionCount: Int,
    val paymentMethod: PaymentMethod
)

data class SessionPurchaseResponse(
    val enrollmentId: UUID,
    val sessionsPurchased: Int,
    val totalPrice: Long,
    val newRemainingBalance: Int,
    val requiresPaymentIntent: Boolean
)

