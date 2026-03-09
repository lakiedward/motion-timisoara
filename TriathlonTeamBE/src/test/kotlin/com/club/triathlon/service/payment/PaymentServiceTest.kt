package com.club.triathlon.service.payment

import com.club.triathlon.domain.Child
import com.club.triathlon.domain.Enrollment
import com.club.triathlon.domain.Payment
import com.club.triathlon.domain.User
import com.club.triathlon.enums.EnrollmentKind
import com.club.triathlon.enums.EnrollmentStatus
import com.club.triathlon.enums.PaymentMethod
import com.club.triathlon.enums.PaymentStatus
import com.club.triathlon.enums.Role
import com.club.triathlon.repo.ActivityRepository
import com.club.triathlon.repo.CampRepository
import com.club.triathlon.repo.CoachProfileRepository
import com.club.triathlon.repo.CourseRepository
import com.club.triathlon.repo.EnrollmentRepository
import com.club.triathlon.repo.PaymentRepository
import com.club.triathlon.service.StripeConnectService
import com.club.triathlon.service.notification.WebSocketNotificationService
import com.stripe.model.PaymentIntent
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNull
import org.mockito.kotlin.eq
import org.mockito.kotlin.mock
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import java.time.OffsetDateTime
import java.util.Optional
import java.util.UUID

class PaymentServiceTest {

    private val enrollmentRepository: EnrollmentRepository = mock()
    private val paymentRepository: PaymentRepository = mock()
    private val courseRepository: CourseRepository = mock()
    private val campRepository: CampRepository = mock()
    private val activityRepository: ActivityRepository = mock()
    private val coachProfileRepository: CoachProfileRepository = mock()
    private val webSocketNotificationService: WebSocketNotificationService = mock()
    private val stripeConnectService: StripeConnectService = mock()

    private lateinit var service: PaymentService

    @BeforeEach
    fun setup() {
        service = PaymentService(
            enrollmentRepository = enrollmentRepository,
            paymentRepository = paymentRepository,
            courseRepository = courseRepository,
            campRepository = campRepository,
            activityRepository = activityRepository,
            coachProfileRepository = coachProfileRepository,
            webSocketNotificationService = webSocketNotificationService,
            stripeConnectService = stripeConnectService,
            webhookSecret = "whsec_test"
        )
    }

    @Test
    fun `handlePaymentFailed cancels enrollment and resets payment`() {
        val parent = User().apply {
            id = UUID.randomUUID()
            role = Role.PARENT
        }
        val child = Child().apply {
            id = UUID.randomUUID()
            this.parent = parent
        }
        val enrollment = Enrollment().apply {
            id = UUID.randomUUID()
            kind = EnrollmentKind.COURSE
            entityId = UUID.randomUUID()
            this.child = child
            status = EnrollmentStatus.PENDING
            createdAt = OffsetDateTime.now()
        }
        val paymentId = UUID.randomUUID()
        val payment = Payment().apply {
            id = paymentId
            this.enrollment = enrollment
            method = PaymentMethod.CARD
            amount = 1000
            currency = "RON"
            status = PaymentStatus.PENDING
            clientSecret = "cs_test"
            gatewayTxnId = "pi_old"
            createdAt = OffsetDateTime.now()
            updatedAt = OffsetDateTime.now()
        }

        whenever(paymentRepository.findById(paymentId)).thenReturn(Optional.of(payment))

        val paymentIntent = mock<PaymentIntent>()
        whenever(paymentIntent.metadata).thenReturn(mapOf("paymentId" to paymentId.toString()))
        whenever(paymentIntent.id).thenReturn("pi_123")
        whenever(paymentIntent.lastPaymentError).thenReturn(null)

        service.handlePaymentFailedIntent(paymentIntent)

        assertEquals(PaymentStatus.FAILED, payment.status)
        assertEquals("pi_123", payment.gatewayTxnId)
        assertNull(payment.clientSecret)
        assertNull(payment.paidAt)
        assertEquals(EnrollmentStatus.CANCELLED, enrollment.status)
        assertEquals(0, enrollment.purchasedSessions)
        assertEquals(0, enrollment.remainingSessions)

        verify(paymentRepository).save(payment)
        verify(enrollmentRepository).save(enrollment)
        verify(webSocketNotificationService).notifyPaymentFailed(eq(parent.id!!), eq(enrollment.id!!), eq("Payment failed"))
    }
}


