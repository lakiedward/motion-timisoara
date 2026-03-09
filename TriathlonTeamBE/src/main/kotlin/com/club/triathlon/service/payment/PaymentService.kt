package com.club.triathlon.service.payment

import com.club.triathlon.domain.Enrollment
import com.club.triathlon.domain.Payment
import com.club.triathlon.enums.EnrollmentKind
import com.club.triathlon.enums.EnrollmentStatus
import com.club.triathlon.enums.PaymentMethod
import com.club.triathlon.enums.PaymentStatus
import com.club.triathlon.repo.ActivityRepository
import com.club.triathlon.repo.CampRepository
import com.club.triathlon.repo.CoachProfileRepository
import com.club.triathlon.repo.CourseRepository
import com.club.triathlon.repo.EnrollmentRepository
import com.club.triathlon.repo.PaymentRepository
import com.club.triathlon.service.StripeConnectService
import com.club.triathlon.service.notification.WebSocketNotificationService
import com.fasterxml.jackson.databind.ObjectMapper
import com.stripe.exception.SignatureVerificationException
import com.stripe.model.Event
import com.stripe.model.PaymentIntent
import com.stripe.net.Webhook
import com.stripe.param.PaymentIntentCreateParams
import org.springframework.beans.factory.annotation.Value
import org.springframework.http.HttpStatus
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.server.ResponseStatusException
import java.time.OffsetDateTime
import java.util.UUID

@Service
class PaymentService(
    private val enrollmentRepository: EnrollmentRepository,
    private val paymentRepository: PaymentRepository,
    private val courseRepository: CourseRepository,
    private val campRepository: CampRepository,
    private val activityRepository: ActivityRepository,
    private val coachProfileRepository: CoachProfileRepository,
    private val webSocketNotificationService: WebSocketNotificationService,
    private val stripeConnectService: StripeConnectService,
    @Value("\${stripe.webhook-secret}") private val webhookSecret: String
) {
    private val logger = org.slf4j.LoggerFactory.getLogger(PaymentService::class.java)
    private val objectMapper = ObjectMapper()

    @Transactional
    fun createPaymentIntent(enrollmentId: UUID): PaymentIntentResponse {
        val payment = paymentRepository.findByEnrollmentId(enrollmentId)
            ?: throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Payment not initialized")
        if (payment.method != PaymentMethod.CARD) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Payment intent required only for card payments")
        }
        val enrollment = payment.enrollment
        // Prefer payment's stored currency; fallback to entity currency if missing
        val currency = (payment.currency.ifBlank {
            when (enrollment.kind) {
                EnrollmentKind.COURSE -> courseRepository.findById(enrollment.entityId).orElseThrow {
                    ResponseStatusException(HttpStatus.NOT_FOUND, "Course not found")
                }.currency
                EnrollmentKind.CAMP -> campRepository.findById(enrollment.entityId).orElseThrow {
                    ResponseStatusException(HttpStatus.NOT_FOUND, "Camp not found")
                }.currency
                EnrollmentKind.ACTIVITY -> activityRepository.findById(enrollment.entityId).orElseThrow {
                    ResponseStatusException(HttpStatus.NOT_FOUND, "Activity not found")
                }.currency
            }
        }).lowercase()

        // payment.amount is already in smallest currency unit (bani for RON)
        val amountInBani = payment.amount

        // Get course/activity data to determine payment recipient
        val course = if (enrollment.kind == EnrollmentKind.COURSE) {
            courseRepository.findById(enrollment.entityId).orElse(null)
        } else null
        
        val activity = if (enrollment.kind == EnrollmentKind.ACTIVITY) {
            activityRepository.findById(enrollment.entityId).orElse(null)
        } else null
        
        val coach = course?.coach ?: activity?.coach
        val coachProfile = coach?.let { coachProfileRepository.findByUser(it) }
        
        // Get configured payment recipient and club from course/activity
        val configuredRecipient = course?.paymentRecipient ?: activity?.paymentRecipient
        val configuredClub = course?.club ?: activity?.club
        
        // Determine payment destination based on course/activity settings:
        // 1. If paymentRecipient=CLUB and club has Stripe → club receives
        // 2. If paymentRecipient=COACH and coach has Stripe → coach receives
        // 3. Fallback: if recipient can't receive, try the other one
        // 4. Otherwise → platform receives payment (no Connect transfer)
        val (destinationAccountId, destinationType) = when (configuredRecipient) {
            com.club.triathlon.enums.PaymentRecipientType.CLUB -> {
                when {
                    // Club configured and can receive payments
                    configuredClub?.canReceivePayments() == true -> {
                        Pair(configuredClub.stripeAccountId!!, "CLUB")
                    }
                    // Fallback to coach if club can't receive
                    coachProfile?.canReceivePayments() == true -> {
                        Pair(coachProfile.stripeAccountId!!, "COACH")
                    }
                    else -> Pair(null, "PLATFORM")
                }
            }
            com.club.triathlon.enums.PaymentRecipientType.COACH -> {
                when {
                    // Coach can receive payments
                    coachProfile?.canReceivePayments() == true -> {
                        Pair(coachProfile.stripeAccountId!!, "COACH")
                    }
                    // Fallback to club if coach can't receive
                    configuredClub?.canReceivePayments() == true -> {
                        Pair(configuredClub.stripeAccountId!!, "CLUB")
                    }
                    else -> Pair(null, "PLATFORM")
                }
            }
            else -> {
                // No configured recipient (legacy data) - use old fallback logic
                when {
                    coachProfile?.canReceivePayments() == true -> {
                        Pair(coachProfile.stripeAccountId!!, "COACH")
                    }
                    coachProfile?.clubs?.firstOrNull { it.canReceivePayments() } != null -> {
                        val club = coachProfile.clubs.first { it.canReceivePayments() }
                        Pair(club.stripeAccountId!!, "CLUB")
                    }
                    else -> Pair(null, "PLATFORM")
                }
            }
        }

        val builder = PaymentIntentCreateParams.builder()
            .setAmount(amountInBani)
            .setCurrency(currency)
            .putMetadata("enrollmentId", enrollment.id.toString())
            .putMetadata("paymentId", payment.id.toString())

        // Add Stripe Connect transfer if destination account available
        if (destinationAccountId != null) {
            // Calculate platform fee (1% + TVA = 1.19%) - amount already in bani
            val feeBreakdown = stripeConnectService.calculatePlatformFee(amountInBani)

            builder
                .setApplicationFeeAmount(feeBreakdown.platformFeeTotal)
                .setTransferData(
                    PaymentIntentCreateParams.TransferData.builder()
                        .setDestination(destinationAccountId)
                        .build()
                )
                .putMetadata("destinationType", destinationType)
                .putMetadata("platformFee", feeBreakdown.platformFeeTotal.toString())
                .putMetadata("recipientAmount", feeBreakdown.coachAmount.toString())
            
            if (coach != null) {
                builder.putMetadata("coachId", coach.id.toString())
            }
            if (destinationType == "CLUB" && configuredClub != null) {
                builder.putMetadata("clubId", configuredClub.id.toString())
            }

            // Store fee breakdown in payment for later reference
            payment.platformFeeAmount = feeBreakdown.platformFeeTotal
            payment.coachPayoutAmount = feeBreakdown.coachAmount

            logger.info(
                "💰 [STRIPE CONNECT] PaymentIntent with split: total={} platformFee={} recipientAmount={} destination={} type={}",
                amountInBani, feeBreakdown.platformFeeTotal, feeBreakdown.coachAmount, destinationAccountId, destinationType
            )
        } else {
            logger.info("💰 [STRIPE] PaymentIntent without Connect (no Stripe account available): total={}", amountInBani)
        }

        if (!payment.billingEmail.isNullOrBlank()) {
            builder.setReceiptEmail(payment.billingEmail)
        }
        val params = builder.build()
        val intent = PaymentIntent.create(params)
        payment.clientSecret = intent.clientSecret
        payment.gatewayTxnId = intent.id
        paymentRepository.save(payment)
        return PaymentIntentResponse(intent.clientSecret)
    }

    @Transactional
    fun handleWebhook(payload: String, signature: String?): StripeWebhookResult {
        if (signature == null) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Missing signature header")
        }
        val event = try {
            Webhook.constructEvent(payload, signature, webhookSecret)
        } catch (ex: SignatureVerificationException) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid signature")
        }
        logger.info("[STRIPE] Webhook received: type={} id={}", event.type, event.id)
        when (event.type) {
            "payment_intent.succeeded" -> handlePaymentSucceeded(event, payload)
            "payment_intent.payment_failed" -> handlePaymentFailed(event)
        }
        return StripeWebhookResult(event.type)
    }

    @Transactional
    fun markCashPaid(paymentId: UUID) {
        val payment = paymentRepository.findById(paymentId).orElseThrow {
            ResponseStatusException(HttpStatus.NOT_FOUND, "Payment not found")
        }
        val enrollment = payment.enrollment
        if (payment.method != PaymentMethod.CASH) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Mark cash paid is only for cash payments")
        }
        val now = OffsetDateTime.now()
        payment.status = PaymentStatus.SUCCEEDED
        payment.updatedAt = now
        payment.paidAt = now
        paymentRepository.save(payment)
        activateEnrollment(enrollment, payment)

        // Notify admin/coach about session purchase
        if (enrollment.kind == EnrollmentKind.COURSE) {
            val course = courseRepository.findById(enrollment.entityId).orElse(null)
            if (course != null && course.pricePerSession > 0) {
                val sessionCountAdded = (payment.amount / course.pricePerSession).toInt()
                webSocketNotificationService.notifySessionPurchase(enrollment.id!!, sessionCountAdded, enrollment.entityId)
            }
        }
    }

    @Transactional
    fun markCashPaidByCoach(paymentId: UUID, coachId: UUID) {
        val payment = paymentRepository.findById(paymentId).orElseThrow {
            ResponseStatusException(HttpStatus.NOT_FOUND, "Payment not found")
        }
        if (payment.method != PaymentMethod.CASH) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Mark cash paid is only for cash payments")
        }
        val enrollment = payment.enrollment
        
        // Validate coach ownership based on enrollment kind
        when (enrollment.kind) {
            EnrollmentKind.COURSE -> {
                val course = courseRepository.findById(enrollment.entityId).orElseThrow {
                    ResponseStatusException(HttpStatus.NOT_FOUND, "Course not found")
                }
                if (course.coach.id != coachId) {
                    throw ResponseStatusException(HttpStatus.FORBIDDEN, "Coach can only mark payments for their own courses")
                }
            }
            EnrollmentKind.ACTIVITY -> {
                val activity = activityRepository.findById(enrollment.entityId).orElseThrow {
                    ResponseStatusException(HttpStatus.NOT_FOUND, "Activity not found")
                }
                if (activity.coach.id != coachId) {
                    throw ResponseStatusException(HttpStatus.FORBIDDEN, "Coach can only mark payments for their own activities")
                }
            }
            else -> throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Coach can only mark payments for course or activity enrollments")
        }
        
        val now = OffsetDateTime.now()
        payment.status = PaymentStatus.SUCCEEDED
        payment.updatedAt = now
        payment.paidAt = now
        paymentRepository.save(payment)
        activateEnrollment(enrollment, payment)

        // Notify admin/coach about session purchase (for courses only)
        if (enrollment.kind == EnrollmentKind.COURSE) {
            val course = courseRepository.findById(enrollment.entityId).orElse(null)
            if (course != null && course.pricePerSession > 0) {
                val sessionCountAdded = (payment.amount / course.pricePerSession).toInt()
                webSocketNotificationService.notifySessionPurchase(enrollment.id!!, sessionCountAdded, enrollment.entityId)
            }
        }
    }

    private fun handlePaymentSucceeded(event: Event, rawPayload: String? = null) {
        // Deserialize PaymentIntent safely (works across Stripe API versions)
        val intent = event.dataObjectDeserializer.`object`.orElse(null) as? PaymentIntent
        if (intent != null) {
            logger.info("[STRIPE] PaymentIntent extracted: id={} metadata={}", intent.id, intent.metadata)

            val paymentIdStr = intent.metadata["paymentId"]
            if (paymentIdStr == null) {
                logger.warn("[STRIPE] Missing paymentId in metadata! intentId={} metadata={}", intent.id, intent.metadata)
                return
            }

            val payment = paymentRepository.findById(UUID.fromString(paymentIdStr)).orElse(null)
            if (payment == null) {
                logger.warn("[STRIPE] Payment not found in DB! paymentId={} intentId={}", paymentIdStr, intent.id)
                return
            }

            logger.info(
                "[STRIPE] payment_intent.succeeded intentId={} paymentId={} enrollmentId={} status={} amount={} currency={}",
                intent.id, payment.id, payment.enrollment.id, payment.status, payment.amount, payment.currency
            )
            if (payment.status == PaymentStatus.SUCCEEDED) {
                logger.info("[STRIPE] Payment already marked SUCCEEDED, skipping.")
                return
            }

            payment.status = PaymentStatus.SUCCEEDED
            payment.updatedAt = OffsetDateTime.now()
            payment.paidAt = payment.updatedAt
            payment.gatewayTxnId = intent.id
            paymentRepository.save(payment)

            activateEnrollment(payment.enrollment, payment)

            if (payment.enrollment.kind == EnrollmentKind.COURSE) {
                val courseId = payment.enrollment.entityId
                val course = courseRepository.findById(courseId).orElse(null)
                if (course != null && course.pricePerSession > 0) {
                    val sessionCountAdded = (payment.amount / course.pricePerSession).toInt()
                    logger.info(
                        "[PAYMENT] Crediting sessions: enrollmentId={} pricePerSession={} paidAmount={} -> addedSessions={} remainingSessions={}",
                        payment.enrollment.id, course.pricePerSession, payment.amount, sessionCountAdded, payment.enrollment.remainingSessions
                    )
                    webSocketNotificationService.notifySessionPurchase(payment.enrollment.id!!, sessionCountAdded, courseId)
                }
            }

            val userId = payment.enrollment.child.parent.id!!
            webSocketNotificationService.notifyEnrollmentReady(userId, payment.enrollment.id!!)
            return
        }

        if (rawPayload == null) {
            logger.warn("[STRIPE] Could not deserialize PaymentIntent for event {}", event.id)
            return
        }

        val root = objectMapper.readTree(rawPayload)
        val objNode = root.path("data").path("object")
        val intentId = objNode.path("id").asText(null)
        val paymentIdStr = objNode.path("metadata").path("paymentId").asText(null)
        if (paymentIdStr == null) {
            logger.warn("[STRIPE] Missing paymentId in metadata! intentId={}", intentId)
            return
        }

        val payment = paymentRepository.findById(UUID.fromString(paymentIdStr)).orElse(null)
        if (payment == null) {
            logger.warn("[STRIPE] Payment not found in DB! paymentId={} intentId={}", paymentIdStr, intentId)
            return
        }

        logger.info(
            "[STRIPE] payment_intent.succeeded intentId={} paymentId={} enrollmentId={} status={} amount={} currency={}",
            intentId, payment.id, payment.enrollment.id, payment.status, payment.amount, payment.currency
        )
        if (payment.status == PaymentStatus.SUCCEEDED) {
            logger.info("[STRIPE] Payment already marked SUCCEEDED, skipping.")
            return
        }

        payment.status = PaymentStatus.SUCCEEDED
        payment.updatedAt = OffsetDateTime.now()
        payment.paidAt = payment.updatedAt
        if (intentId != null) {
            payment.gatewayTxnId = intentId
        }
        paymentRepository.save(payment)

        activateEnrollment(payment.enrollment, payment)

        if (payment.enrollment.kind == EnrollmentKind.COURSE) {
            val courseId = payment.enrollment.entityId
            val course = courseRepository.findById(courseId).orElse(null)
            if (course != null && course.pricePerSession > 0) {
                val sessionCountAdded = (payment.amount / course.pricePerSession).toInt()
                logger.info(
                    "[PAYMENT] Crediting sessions: enrollmentId={} pricePerSession={} paidAmount={} -> addedSessions={} remainingSessions={}",
                    payment.enrollment.id, course.pricePerSession, payment.amount, sessionCountAdded, payment.enrollment.remainingSessions
                )
                webSocketNotificationService.notifySessionPurchase(payment.enrollment.id!!, sessionCountAdded, courseId)
            }
        }

        val userId = payment.enrollment.child.parent.id!!
        webSocketNotificationService.notifyEnrollmentReady(userId, payment.enrollment.id!!)
    }

    private fun handlePaymentFailed(event: Event) {
        val intent = event.dataObjectDeserializer.`object`.orElse(null) as? PaymentIntent ?: return
        handlePaymentFailedIntent(intent)
    }

    internal fun handlePaymentFailedIntent(intent: PaymentIntent) {
        val payment = intent.metadata["paymentId"]?.let { paymentRepository.findById(UUID.fromString(it)).orElse(null) } ?: return
        logger.warn("[STRIPE] payment_intent.payment_failed intentId={} paymentId={} enrollmentId={}", intent.id, payment.id, payment.enrollment.id)
        payment.status = PaymentStatus.FAILED
        payment.updatedAt = OffsetDateTime.now()
        payment.gatewayTxnId = intent.id
        payment.clientSecret = null
        payment.paidAt = null
        paymentRepository.save(payment)
        val enrollment = payment.enrollment
        enrollment.status = EnrollmentStatus.CANCELLED
        enrollment.firstSessionDate = null
        enrollment.purchasedSessions = 0
        enrollment.remainingSessions = 0
        enrollment.sessionsUsed = 0
        enrollmentRepository.save(enrollment)

        val userId = payment.enrollment.child.parent.id!!
        val failureReason = intent.lastPaymentError?.message ?: "Payment failed"
        webSocketNotificationService.notifyPaymentFailed(userId, payment.enrollment.id!!, failureReason)
    }

    private fun activateEnrollment(enrollment: Enrollment, payment: Payment? = null) {
        enrollment.status = EnrollmentStatus.ACTIVE

        // For course enrollments, always credit sessions associated with this payment
        if (enrollment.kind == EnrollmentKind.COURSE && payment != null) {
            val course = courseRepository.findById(enrollment.entityId).orElse(null)
            if (course != null && course.pricePerSession > 0) {
                val sessionCountAdded = (payment.amount / course.pricePerSession).toInt()
                if (sessionCountAdded > 0) {
                    enrollment.purchasedSessions += sessionCountAdded
                    enrollment.remainingSessions += sessionCountAdded
                    logger.info("[ENROLLMENT] Activated and credited sessions: enrollmentId={} added={} purchasedSessions={} remainingSessions={}",
                        enrollment.id, sessionCountAdded, enrollment.purchasedSessions, enrollment.remainingSessions)
                }
            }
        }

        enrollmentRepository.save(enrollment)
    }

    private fun toMinorUnits(majorAmount: Long, currency: String): Long {
        val zeroDecimal = setOf(
            "bif", "clp", "djf", "gnf", "jpy", "kmf", "krw", "mga", "pyg", "rwf",
            "ugx", "vnd", "vuv", "xaf", "xpf", "xof"
        )
        return if (zeroDecimal.contains(currency)) majorAmount else majorAmount * 100
    }
}

data class PaymentIntentResponse(val clientSecret: String?)

data class StripeWebhookResult(val eventType: String)

