package com.club.triathlon.service.enrollment

import com.club.triathlon.domain.Camp
import com.club.triathlon.domain.Child
import com.club.triathlon.domain.Course
import com.club.triathlon.domain.Enrollment
import com.club.triathlon.domain.Payment
import com.club.triathlon.domain.Sport
import com.club.triathlon.domain.User
import com.club.triathlon.enums.EnrollmentKind
import com.club.triathlon.enums.EnrollmentStatus
import com.club.triathlon.enums.PaymentMethod
import com.club.triathlon.enums.PaymentStatus
import com.club.triathlon.enums.Role
import com.club.triathlon.service.payment.MonthlyPaymentService
import com.club.triathlon.domain.MonthlyPayment
import com.club.triathlon.repo.ActivityRepository
import com.club.triathlon.repo.CampRepository
import com.club.triathlon.repo.ChildRepository
import com.club.triathlon.repo.CourseRepository
import com.club.triathlon.repo.EnrollmentRepository
import com.club.triathlon.repo.PaymentRepository
import com.club.triathlon.security.UserPrincipal
import com.club.triathlon.service.notification.WebSocketNotificationService
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.mock
import org.mockito.kotlin.whenever
import org.springframework.http.HttpStatus
import org.springframework.security.core.context.SecurityContext
import org.springframework.security.core.context.SecurityContextHolder
import org.springframework.web.server.ResponseStatusException
import java.time.LocalDate
import java.time.OffsetDateTime
import java.util.Optional
import java.util.UUID

class EnrollmentServiceTest {

    private val enrollmentRepository: EnrollmentRepository = mock()
    private val paymentRepository: PaymentRepository = mock()
    private val childRepository: ChildRepository = mock()
    private val courseRepository: CourseRepository = mock()
    private val campRepository: CampRepository = mock()
    private val activityRepository: ActivityRepository = mock()
    private val monthlyPaymentService: MonthlyPaymentService = mock()
    private val webSocketNotificationService: WebSocketNotificationService = mock()

    private lateinit var service: EnrollmentService

    private val parent = User().apply {
        id = UUID.randomUUID()
        role = Role.PARENT
        name = "Parent"
        email = "parent@example.com"
        passwordHash = "hash"
        createdAt = OffsetDateTime.now()
    }

    @BeforeEach
    fun setup() {
        service = EnrollmentService(
            enrollmentRepository = enrollmentRepository,
            paymentRepository = paymentRepository,
            childRepository = childRepository,
            courseRepository = courseRepository,
            campRepository = campRepository,
            activityRepository = activityRepository,
            monthlyPaymentService = monthlyPaymentService,
            webSocketNotificationService = webSocketNotificationService
        )
        val authentication = mock<org.springframework.security.core.Authentication>()
        whenever(authentication.principal).thenReturn(UserPrincipal(parent))
        val context = mock<SecurityContext>()
        whenever(context.authentication).thenReturn(authentication)
        SecurityContextHolder.setContext(context)

        whenever(paymentRepository.save(any<Payment>())).thenAnswer { invocation ->
            val payment = invocation.arguments[0] as Payment
            payment.id = payment.id ?: UUID.randomUUID()
            payment
        }
        whenever(enrollmentRepository.save(any<Enrollment>())).thenAnswer { invocation ->
            val enrollment = invocation.arguments[0] as Enrollment
            enrollment.id = enrollment.id ?: UUID.randomUUID()
            enrollment
        }
        whenever(enrollmentRepository.findByKindAndEntityIdAndChildAndStatusIn(any(), any(), any(), any())).thenReturn(emptyList())

        // Monthly payment service stubs
        whenever(monthlyPaymentService.getCurrentMonthString()).thenReturn("2025-10")
        whenever(monthlyPaymentService.generateMonthlyPayment(any(), any(), any(), any(), any())).thenReturn(mock<MonthlyPayment>())
    }

    @Test
    fun `course enrollment accepts cash`() {
        val child = childOwnedByParent()
        val courseId = UUID.randomUUID()
        whenever(childRepository.findById(child.id!!)).thenReturn(Optional.of(child))
        whenever(courseRepository.findById(courseId)).thenReturn(Optional.of(course(price = 1000)))
        whenever(enrollmentRepository.countByKindAndEntityIdAndStatusIn(any(), any(), any())).thenReturn(0)
        whenever(enrollmentRepository.findByKindAndEntityIdAndChildAndStatusIn(any(), any(), any(), any())).thenReturn(emptyList())

        val request = EnrollmentRequest(
            kind = EnrollmentKind.COURSE,
            entityId = courseId,
            childIds = listOf(child.id!!),
            paymentMethod = PaymentMethod.CASH
        )

        val response = service.createEnrollment(request)
        assert(!response.requiresPaymentIntent)
    }

    @Test
    fun `camp enrollment cash not allowed when camp disallows`() {
        val child = childOwnedByParent()
        val campId = UUID.randomUUID()
        whenever(childRepository.findById(child.id!!)).thenReturn(Optional.of(child))
        whenever(campRepository.findById(campId)).thenReturn(Optional.of(camp(allowCash = false)))
        whenever(enrollmentRepository.countByKindAndEntityIdAndStatusIn(any(), any(), any())).thenReturn(0)
        whenever(enrollmentRepository.findByKindAndEntityIdAndChildAndStatusIn(any(), any(), any(), any())).thenReturn(emptyList())

        val request = EnrollmentRequest(
            kind = EnrollmentKind.CAMP,
            entityId = campId,
            childIds = listOf(child.id!!),
            paymentMethod = PaymentMethod.CASH
        )

        val ex = assertThrows(ResponseStatusException::class.java) {
            service.createEnrollment(request)
        }
        assert(ex.statusCode == HttpStatus.BAD_REQUEST)
    }

    @Test
    fun `capacity full throws`() {
        val child = childOwnedByParent()
        val courseId = UUID.randomUUID()
        whenever(childRepository.findById(child.id!!)).thenReturn(Optional.of(child))
        whenever(courseRepository.findById(courseId)).thenReturn(Optional.of(course(price = 1000, capacity = 1)))
        whenever(enrollmentRepository.countByKindAndEntityIdAndStatusIn(any(), any(), any())).thenReturn(1)
        whenever(enrollmentRepository.findByKindAndEntityIdAndChildAndStatusIn(any(), any(), any(), any())).thenReturn(emptyList())

        val request = EnrollmentRequest(
            kind = EnrollmentKind.COURSE,
            entityId = courseId,
            childIds = listOf(child.id!!),
            paymentMethod = PaymentMethod.CARD
        )

        val ex = assertThrows(ResponseStatusException::class.java) {
            service.createEnrollment(request)
        }
        assert(ex.statusCode == HttpStatus.BAD_REQUEST)
    }

    @Test
    fun `duplicate enrollment blocked for cash`() {
        val child = childOwnedByParent()
        val campId = UUID.randomUUID()
        whenever(childRepository.findById(child.id!!)).thenReturn(Optional.of(child))
        whenever(campRepository.findById(campId)).thenReturn(Optional.of(camp()))
        val existing = Enrollment().apply {
            id = UUID.randomUUID()
            status = EnrollmentStatus.PENDING
            kind = EnrollmentKind.CAMP
            entityId = campId
            this.child = child
            createdAt = OffsetDateTime.now()
        }
        whenever(enrollmentRepository.findByKindAndEntityIdAndChildAndStatusIn(any(), any(), any(), any())).thenReturn(listOf(existing))

        val request = EnrollmentRequest(
            kind = EnrollmentKind.CAMP,
            entityId = campId,
            childIds = listOf(child.id!!),
            paymentMethod = PaymentMethod.CASH
        )

        val ex = assertThrows(ResponseStatusException::class.java) {
            service.createEnrollment(request)
        }
        assert(ex.statusCode == HttpStatus.CONFLICT)
    }

    @Test
    fun `cancel draft enrollment marks payment failed`() {
        val child = childOwnedByParent()
        val enrollmentId = UUID.randomUUID()
        val enrollment = Enrollment().apply {
            id = enrollmentId
            kind = EnrollmentKind.COURSE
            entityId = UUID.randomUUID()
            this.child = child
            status = EnrollmentStatus.PENDING
            createdAt = OffsetDateTime.now()
        }
        val payment = Payment().apply {
            this.enrollment = enrollment
            method = PaymentMethod.CARD
            status = PaymentStatus.PENDING
            clientSecret = "cs_test"
            gatewayTxnId = "pi_test"
            createdAt = OffsetDateTime.now()
            updatedAt = OffsetDateTime.now()
        }

        whenever(childRepository.findById(child.id!!)).thenReturn(Optional.of(child))
        whenever(enrollmentRepository.findById(enrollmentId)).thenReturn(Optional.of(enrollment))
        whenever(paymentRepository.findByEnrollmentId(enrollmentId)).thenReturn(payment)

        service.cancelDraftEnrollment(enrollmentId)

        assert(enrollment.status == EnrollmentStatus.CANCELLED)
        assert(payment.status == PaymentStatus.FAILED)
        assert(payment.clientSecret == null)
        assert(payment.gatewayTxnId == null)
    }

    private fun childOwnedByParent(): Child {
        return Child().apply {
            id = UUID.randomUUID()
            name = "Kid"
            this.parent = this@EnrollmentServiceTest.parent
            birthDate = LocalDate.of(2015, 1, 1)
        }
    }

    private fun course(price: Long, capacity: Int? = 5): Course {
        return Course().apply {
            id = UUID.randomUUID()
            name = "Swim"
            sport = Sport().apply {
                id = UUID.randomUUID()
                code = "swim"
                name = "Inot"
            }
            this.capacity = capacity
            this.price = price
            this.coach = User().apply {
                id = UUID.randomUUID()
                role = Role.COACH
                name = "Coach"
                email = "coach@example.com"
                passwordHash = "hash"
                createdAt = OffsetDateTime.now()
            }
            this.location = com.club.triathlon.domain.Location().apply {
                id = UUID.randomUUID()
                name = "Pool"
                type = com.club.triathlon.enums.LocationType.POOL
            }
        }
    }

    private fun camp(allowCash: Boolean = true): Camp {
        return Camp().apply {
            id = UUID.randomUUID()
            title = "Summer Camp"
            slug = "summer-camp"
            periodStart = LocalDate.now()
            periodEnd = LocalDate.now().plusDays(5)
            capacity = 10
            price = 2000
            this.allowCash = allowCash
        }
    }
}

