package com.club.triathlon.service.enrollment

import com.club.triathlon.domain.Camp
import com.club.triathlon.domain.Child
import com.club.triathlon.domain.Course
import com.club.triathlon.domain.Enrollment
import com.club.triathlon.domain.Payment
import com.club.triathlon.domain.User
import com.club.triathlon.enums.EnrollmentKind
import com.club.triathlon.enums.EnrollmentStatus
import com.club.triathlon.enums.PaymentMethod
import com.club.triathlon.enums.PaymentStatus
import com.club.triathlon.repo.ActivityRepository
import com.club.triathlon.repo.CampRepository
import com.club.triathlon.repo.ChildRepository
import com.club.triathlon.repo.CourseRepository
import com.club.triathlon.repo.EnrollmentRepository
import com.club.triathlon.repo.PaymentRepository
import com.club.triathlon.security.UserPrincipal
import com.club.triathlon.service.notification.WebSocketNotificationService
import org.springframework.http.HttpStatus
import org.springframework.security.core.context.SecurityContextHolder
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.server.ResponseStatusException
import java.time.OffsetDateTime
import java.util.UUID
import java.math.BigDecimal

@Service
class EnrollmentService(
    private val enrollmentRepository: EnrollmentRepository,
    private val paymentRepository: PaymentRepository,
    private val childRepository: ChildRepository,
    private val courseRepository: CourseRepository,
    private val campRepository: CampRepository,
    private val activityRepository: ActivityRepository,
    private val monthlyPaymentService: com.club.triathlon.service.payment.MonthlyPaymentService,
    private val webSocketNotificationService: WebSocketNotificationService
) {

    @Transactional
    fun createEnrollment(request: EnrollmentRequest): EnrollmentCreateResponse {
        val parent = currentUser().takeIf { it.role == com.club.triathlon.enums.Role.PARENT }
            ?: throw ResponseStatusException(HttpStatus.FORBIDDEN, "Only parents can enroll children")

        val childIds = request.childIds
            .takeIf { it.isNotEmpty() }
            ?: throw ResponseStatusException(HttpStatus.BAD_REQUEST, "At least one child must be specified")

        // Validate all children belong to parent
        val children = childIds.map { childId ->
            val child = childRepository.findById(childId).orElseThrow {
                ResponseStatusException(HttpStatus.BAD_REQUEST, "Child not found: $childId")
            }
            if (child.parent.id != parent.id) {
                throw ResponseStatusException(HttpStatus.FORBIDDEN, "Child does not belong to parent: ${child.name}")
            }
            child
        }

        val statusFilter = listOf(EnrollmentStatus.PENDING, EnrollmentStatus.ACTIVE)
        val childContexts = children.map { child ->
            child to enrollmentRepository.findByKindAndEntityIdAndChildAndStatusIn(request.kind, request.entityId, child, statusFilter)
        }

        when (request.paymentMethod) {
            PaymentMethod.CARD -> {
                childContexts.forEach { (child, existing) ->
                    if (existing.any { it.status == EnrollmentStatus.ACTIVE }) {
                        throw ResponseStatusException(HttpStatus.CONFLICT, "Child already enrolled: ${child.name}")
                    }
                }
            }
            PaymentMethod.CASH -> {
                childContexts.forEach { (child, existing) ->
                    if (existing.isNotEmpty()) {
                        throw ResponseStatusException(HttpStatus.CONFLICT, "Child already enrolled: ${child.name}")
                    }
                }
            }
        }

        val newEnrollmentCount = when (request.paymentMethod) {
            PaymentMethod.CARD -> childContexts.count { (_, existing) -> existing.none { it.status == EnrollmentStatus.PENDING } }
            PaymentMethod.CASH -> childContexts.size
        }

        // Get entity price and session info
        val entityPrice: Long
        var paymentCurrency = "RON"
        var sessionPackageSize = request.sessionPackageSize ?: 1  // Default to 1 session

        when (request.kind) {
            EnrollmentKind.COURSE -> {
                val course = courseRepository.findById(request.entityId).orElseThrow {
                    ResponseStatusException(HttpStatus.BAD_REQUEST, "Course not found")
                }
                if (newEnrollmentCount > 0) {
                    ensureCapacity(course.capacity, request.kind, request.entityId, newEnrollmentCount)
                }
                // Calculate price based on session package size
                entityPrice = course.pricePerSession * sessionPackageSize
                paymentCurrency = course.currency
            }
            EnrollmentKind.CAMP -> {
                val camp = campRepository.findById(request.entityId).orElseThrow {
                    ResponseStatusException(HttpStatus.BAD_REQUEST, "Camp not found")
                }
                if (request.paymentMethod == PaymentMethod.CASH && !camp.allowCash) {
                    throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Cash payments not allowed for this camp")
                }
                if (newEnrollmentCount > 0) {
                    ensureCapacity(camp.capacity ?: 0, request.kind, request.entityId, newEnrollmentCount)
                }
                // Camps remain as single payment (not session-based)
                entityPrice = camp.price
                paymentCurrency = camp.currency
                sessionPackageSize = 1  // Camps don't use sessions
            }
            EnrollmentKind.ACTIVITY -> {
                val activity = activityRepository.findById(request.entityId).orElseThrow {
                    ResponseStatusException(HttpStatus.BAD_REQUEST, "Activity not found")
                }
                if (newEnrollmentCount > 0 && activity.capacity != null) {
                    ensureCapacity(activity.capacity!!, request.kind, request.entityId, newEnrollmentCount)
                }
                // Activities are single events (like camps)
                entityPrice = activity.price
                paymentCurrency = activity.currency
                sessionPackageSize = 1  // Activities are one-time events
            }
        }

        val now = OffsetDateTime.now()
        val savedEnrollments = when (request.paymentMethod) {
            PaymentMethod.CARD -> childContexts.map { (child, existing) ->
                prepareCardDraftEnrollment(
                    child = child,
                    existing = existing,
                    request = request,
                    entityPrice = entityPrice,
                    paymentCurrency = paymentCurrency,
                    now = now
                )
            }
            PaymentMethod.CASH -> childContexts.map { (child, _) ->
                createCashEnrollment(
                    child = child,
                    kind = request.kind,
                    entityId = request.entityId,
                    entityPrice = entityPrice,
                    paymentCurrency = paymentCurrency,
                    sessionPackageSize = sessionPackageSize,
                    now = now
                )
            }
        }

        val primaryEnrollmentId = savedEnrollments.firstOrNull()?.id
            ?: throw ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Enrollment could not be prepared")

        return EnrollmentCreateResponse(
            enrollmentId = primaryEnrollmentId,
            requiresPaymentIntent = request.paymentMethod == PaymentMethod.CARD
        )
    }

    @Transactional(readOnly = true)
    fun listParentEnrollments(): List<EnrollmentDto> {
        val parent = currentUser().takeIf { it.role == com.club.triathlon.enums.Role.PARENT }
            ?: throw ResponseStatusException(HttpStatus.FORBIDDEN, "Only parents can view enrollments")
        val enrollments = enrollmentRepository.findByParent(parent)
        return mapEnrollments(enrollments)
    }

    @Transactional(readOnly = true)
    fun listCoachCourseEnrollments(courseId: UUID): List<EnrollmentDto> {
        val coach = currentUser()
        val course = courseRepository.findById(courseId).orElseThrow {
            ResponseStatusException(HttpStatus.NOT_FOUND, "Course not found")
        }
        if (coach.role != com.club.triathlon.enums.Role.COACH || course.coach.id != coach.id) {
            throw ResponseStatusException(HttpStatus.FORBIDDEN, "Not allowed to view this course enrollments")
        }
        val enrollments = enrollmentRepository.findByKindAndEntityId(EnrollmentKind.COURSE, courseId)
        return mapEnrollments(enrollments)
    }

    @Transactional(readOnly = true)
    fun listCoachActivityEnrollments(activityId: UUID): List<EnrollmentDto> {
        val coach = currentUser()
        val activity = activityRepository.findById(activityId).orElseThrow {
            ResponseStatusException(HttpStatus.NOT_FOUND, "Activity not found")
        }
        if (coach.role != com.club.triathlon.enums.Role.COACH || activity.coach.id != coach.id) {
            throw ResponseStatusException(HttpStatus.FORBIDDEN, "Not allowed to view this activity enrollments")
        }
        val enrollments = enrollmentRepository.findByKindAndEntityId(EnrollmentKind.ACTIVITY, activityId)
        return mapEnrollments(enrollments)
    }

    @Transactional(readOnly = true)
    fun listAdminEnrollments(kind: EnrollmentKind?, status: EnrollmentStatus?, coachId: UUID?): List<EnrollmentDto> {
        val user = currentUser()
        if (user.role != com.club.triathlon.enums.Role.ADMIN) {
            throw ResponseStatusException(HttpStatus.FORBIDDEN, "Only admins can view all enrollments")
        }
        val enrollments = enrollmentRepository.findForAdmin(kind, status, coachId)
        return mapEnrollments(enrollments)
    }

    @Transactional
    fun cancelDraftEnrollment(enrollmentId: UUID) {
        val parent = currentUser().takeIf { it.role == com.club.triathlon.enums.Role.PARENT }
            ?: throw ResponseStatusException(HttpStatus.FORBIDDEN, "Only parents can cancel enrollments")

        val enrollment = enrollmentRepository.findById(enrollmentId).orElseThrow {
            ResponseStatusException(HttpStatus.NOT_FOUND, "Enrollment not found")
        }

        if (enrollment.child.parent.id != parent.id) {
            throw ResponseStatusException(HttpStatus.FORBIDDEN, "Cannot cancel enrollment for another parent")
        }

        if (enrollment.status != EnrollmentStatus.PENDING) {
            return
        }

        enrollment.status = EnrollmentStatus.CANCELLED
        enrollment.purchasedSessions = 0
        enrollment.remainingSessions = 0
        enrollment.sessionsUsed = 0
        enrollmentRepository.save(enrollment)

        val payment = enrollment.id?.let { paymentRepository.findByEnrollmentId(it) }
        if (payment != null && payment.method == PaymentMethod.CARD) {
            payment.status = PaymentStatus.FAILED
            payment.gatewayTxnId = null
            payment.clientSecret = null
            payment.paidAt = null
            payment.updatedAt = OffsetDateTime.now()
            paymentRepository.save(payment)
        }
    }

    private fun createCashEnrollment(
        child: Child,
        kind: EnrollmentKind,
        entityId: UUID,
        entityPrice: Long,
        paymentCurrency: String,
        sessionPackageSize: Int,
        now: OffsetDateTime
    ): Enrollment {
        val enrollment = buildPendingEnrollment(child, kind, entityId, now)
        val savedEnrollment = enrollmentRepository.save(enrollment)

        // Create PENDING payment record that requires coach confirmation
        val payment = Payment().apply {
            this.enrollment = savedEnrollment
            method = PaymentMethod.CASH
            amount = entityPrice
            currency = paymentCurrency
            status = PaymentStatus.PENDING
            createdAt = now
            updatedAt = now
        }
        paymentRepository.save(payment)

        // Notify coach that cash payment is pending confirmation
        when (kind) {
            EnrollmentKind.COURSE -> {
                webSocketNotificationService.notifyPendingCashPayment(
                    savedEnrollment.id!!,
                    payment.id!!,
                    sessionPackageSize,
                    entityId
                )
            }
            EnrollmentKind.ACTIVITY -> {
                val activity = activityRepository.findById(entityId).orElse(null)
                if (activity != null) {
                    webSocketNotificationService.notifyPendingActivityCashPayment(
                        savedEnrollment.id!!,
                        payment.id!!,
                        entityId,
                        child.name,
                        activity.name
                    )
                }
            }
            else -> { /* CAMP - no notification needed */ }
        }

        return savedEnrollment
    }

    private fun prepareCardDraftEnrollment(
        child: Child,
        existing: List<Enrollment>,
        request: EnrollmentRequest,
        entityPrice: Long,
        paymentCurrency: String,
        now: OffsetDateTime
    ): Enrollment {
        val pending = existing.filter { it.status == EnrollmentStatus.PENDING }
            .maxByOrNull { it.createdAt }

        val enrollment = if (pending != null) {
            pending.apply {
                status = EnrollmentStatus.PENDING
                purchasedSessions = 0
                remainingSessions = 0
                sessionsUsed = 0
                firstSessionDate = null
            }
        } else {
            buildPendingEnrollment(child, request.kind, request.entityId, now)
        }

        val persisted = enrollmentRepository.save(enrollment)

        val existingPayment = persisted.id?.let { paymentRepository.findByEnrollmentId(it) }
        if (existingPayment != null && existingPayment.status == PaymentStatus.SUCCEEDED) {
            throw ResponseStatusException(HttpStatus.CONFLICT, "Child already enrolled: ${child.name}")
        }

        val payment = existingPayment ?: Payment().apply {
            this.enrollment = persisted
            method = PaymentMethod.CARD
            createdAt = now
        }
        payment.method = PaymentMethod.CARD
        payment.amount = entityPrice
        payment.currency = paymentCurrency
        payment.status = PaymentStatus.PENDING
        payment.gatewayTxnId = null
        payment.clientSecret = null
        payment.paidAt = null
        payment.updatedAt = now
        // Persist billing details for invoice & Stripe receipt
        request.billingDetails?.let { b ->
            payment.billingName = b.name
            payment.billingEmail = b.email
            payment.billingAddressLine1 = b.addressLine1
            payment.billingCity = b.city
            payment.billingPostalCode = b.postalCode
        }
        // Default country to Romania for PF invoices
        payment.billingCountry = "RO"
        paymentRepository.save(payment)

        return persisted
    }

    private fun buildPendingEnrollment(child: Child, kind: EnrollmentKind, entityId: UUID, now: OffsetDateTime): Enrollment {
        return Enrollment().apply {
            this.child = child
            this.kind = kind
            this.entityId = entityId
            status = EnrollmentStatus.PENDING
            createdAt = now
            firstSessionDate = null
            purchasedSessions = 0
            remainingSessions = 0
            sessionsUsed = 0
        }
    }

    private fun ensureCapacity(capacity: Int?, kind: EnrollmentKind, entityId: UUID, requestedSpots: Int = 1) {
        if (capacity == null || capacity <= 0) return
        val count = enrollmentRepository.countByKindAndEntityIdAndStatusIn(
            kind,
            entityId,
            listOf(EnrollmentStatus.PENDING, EnrollmentStatus.ACTIVE)
        )
        val availableSpots = capacity - count
        if (availableSpots < requestedSpots) {
            throw ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "Not enough available spots. Requested: $requestedSpots, Available: $availableSpots"
            )
        }
    }

    @Transactional(readOnly = true)
    fun getEnrollmentById(id: UUID): Enrollment {
        return enrollmentRepository.findByIdWithChildAndParent(id)
            ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "Enrollment not found")
    }

    private fun mapEnrollments(enrollments: List<Enrollment>): List<EnrollmentDto> {
        if (enrollments.isEmpty()) return emptyList()

        val courseIds = enrollments.filter { it.kind == EnrollmentKind.COURSE }.map { it.entityId }
        val campIds = enrollments.filter { it.kind == EnrollmentKind.CAMP }.map { it.entityId }
        val activityIds = enrollments.filter { it.kind == EnrollmentKind.ACTIVITY }.map { it.entityId }
        val courses = if (courseIds.isNotEmpty()) courseRepository.findAllById(courseIds).associateBy { it.id } else emptyMap()
        val camps = if (campIds.isNotEmpty()) campRepository.findAllById(campIds).associateBy { it.id } else emptyMap()
        val activities = if (activityIds.isNotEmpty()) activityRepository.findAllById(activityIds).associateBy { it.id } else emptyMap()
        val payments = paymentRepository.findByEnrollmentIn(enrollments).associateBy { it.enrollment.id }

        return enrollments.map { enrollment ->
            val child = enrollment.child
            val childDto = ChildSummary(
                id = child.id!!,
                name = child.name
            )
            val entity = when (enrollment.kind) {
                EnrollmentKind.COURSE -> courses[enrollment.entityId]?.let { course ->
                    EntitySummary(
                        id = course.id!!,
                        name = course.name,
                        type = EnrollmentKind.COURSE
                    )
                }
                EnrollmentKind.CAMP -> camps[enrollment.entityId]?.let { camp ->
                    EntitySummary(
                        id = camp.id!!,
                        name = camp.title,
                        type = EnrollmentKind.CAMP
                    )
                }
                EnrollmentKind.ACTIVITY -> activities[enrollment.entityId]?.let { activity ->
                    EntitySummary(
                        id = activity.id!!,
                        name = activity.name,
                        type = EnrollmentKind.ACTIVITY
                    )
                }
            }
            val payment = payments[enrollment.id]?.toDto()
            EnrollmentDto(
                id = enrollment.id!!,
                kind = enrollment.kind,
                status = enrollment.status,
                child = childDto,
                entity = entity,
                payment = payment,
                createdAt = enrollment.createdAt,
                purchasedSessions = enrollment.purchasedSessions,
                remainingSessions = enrollment.remainingSessions,
                sessionsUsed = enrollment.sessionsUsed
            )
        }
    }

    private fun Payment.toDto() = PaymentSummary(
        id = this.id!!,
        method = this.method,
        status = this.status,
        amount = this.amount,
        createdAt = this.createdAt,
        paidAt = this.paidAt
    )

    private fun currentUser(): User {
        val authentication = SecurityContextHolder.getContext().authentication
        val principal = authentication?.principal
        if (principal is UserPrincipal) {
            return principal.user
        }
        throw ResponseStatusException(HttpStatus.UNAUTHORIZED, "Unauthenticated")
    }
}

data class EnrollmentRequest(
    val kind: EnrollmentKind,
    val entityId: UUID,
    val childIds: List<UUID>,
    val paymentMethod: PaymentMethod,
    val sessionPackageSize: Int? = null,  // Number of sessions to purchase
    val billingDetails: BillingDetailsRequest? = null
)

data class EnrollmentCreateResponse(
    val enrollmentId: UUID,
    val requiresPaymentIntent: Boolean
)

data class EnrollmentDto(
    val id: UUID,
    val kind: EnrollmentKind,
    val status: EnrollmentStatus,
    val child: ChildSummary,
    val entity: EntitySummary?,
    val payment: PaymentSummary?,
    val createdAt: OffsetDateTime,
    val purchasedSessions: Int = 0,
    val remainingSessions: Int = 0,
    val sessionsUsed: Int = 0
)

data class ChildSummary(
    val id: UUID,
    val name: String
)

data class EntitySummary(
    val id: UUID,
    val name: String,
    val type: EnrollmentKind
)

data class PaymentSummary(
    val id: UUID,
    val method: PaymentMethod,
    val status: PaymentStatus,
    val amount: Long,
    val createdAt: OffsetDateTime,
    val paidAt: OffsetDateTime?
)

data class BillingDetailsRequest(
    val name: String,
    val email: String,
    val addressLine1: String,
    val city: String,
    val postalCode: String
)
