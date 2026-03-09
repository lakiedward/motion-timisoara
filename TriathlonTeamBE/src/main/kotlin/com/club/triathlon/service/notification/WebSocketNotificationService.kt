package com.club.triathlon.service.notification

import org.slf4j.LoggerFactory
import org.springframework.messaging.simp.SimpMessagingTemplate
import org.springframework.stereotype.Service
import java.util.UUID

/**
 * WebSocket notification service for real-time push notifications to frontend
 *
 * This service sends WebSocket messages to connected clients using STOMP protocol.
 * Primary use case: Notify frontend when Stripe webhook completes payment processing
 * and enrollment is activated, eliminating race conditions with setTimeout delays.
 *
 * Destinations:
 * - /topic/user/{userId}/payments - User-specific payment notifications
 * - /topic/admin/session-purchases - Broadcast to admin/coach for attendance panel updates
 *
 * @property messagingTemplate Spring's SimpMessagingTemplate for sending WebSocket messages
 */
@Service
class WebSocketNotificationService(
    private val messagingTemplate: SimpMessagingTemplate
) {
    private val logger = LoggerFactory.getLogger(WebSocketNotificationService::class.java)

    /**
     * Notify frontend that enrollment is ready after webhook processing
     *
     * Sends a real-time notification to the user's WebSocket channel when:
     * - Stripe webhook has been received and processed
     * - Payment status has been updated to SUCCEEDED
     * - Enrollment has been activated with sessions added
     *
     * Frontend listens to this notification and immediately navigates to dashboard
     * without any artificial setTimeout delays.
     *
     * @param userId Parent user ID (owner of the enrollment)
     * @param enrollmentId Enrollment ID that was activated
     */
    fun notifyEnrollmentReady(userId: UUID, enrollmentId: UUID) {
        val destination = "/topic/user/$userId/payments"
        val message = EnrollmentReadyEvent(
            enrollmentId = enrollmentId.toString(),
            status = "ACTIVE",
            timestamp = System.currentTimeMillis()
        )

        try {
            messagingTemplate.convertAndSend(destination, message)
            logger.info("✅ WebSocket notification sent: $destination → enrollmentId=$enrollmentId")
        } catch (e: Exception) {
            logger.error("❌ Failed to send WebSocket notification to $destination", e)
            // Don't throw - webhook processing should continue even if WebSocket fails
        }
    }

    /**
     * Notify frontend about payment failure
     *
     * Sends notification when Stripe webhook indicates payment has failed.
     * Frontend can show appropriate error message to user.
     *
     * @param userId Parent user ID
     * @param enrollmentId Enrollment ID associated with failed payment
     * @param reason Failure reason from Stripe
     */
    fun notifyPaymentFailed(userId: UUID, enrollmentId: UUID, reason: String) {
        val destination = "/topic/user/$userId/payments"
        val message = PaymentFailedEvent(
            enrollmentId = enrollmentId.toString(),
            reason = reason,
            timestamp = System.currentTimeMillis()
        )

        try {
            messagingTemplate.convertAndSend(destination, message)
            logger.warn("⚠️ WebSocket payment failure notification sent: $destination → enrollmentId=$enrollmentId, reason=$reason")
        } catch (e: Exception) {
            logger.error("❌ Failed to send WebSocket failure notification to $destination", e)
        }
    }


    /**
     * Notify admin/coach about session purchase
     *
     * Broadcasts notification to all admin/coach users when a parent purchases
     * additional sessions. This allows real-time updates in admin attendance panel.
     *
     * @param enrollmentId Enrollment ID for which sessions were purchased
     * @param sessionCount Number of sessions purchased
     * @param courseId Course ID for filtering (coaches only see their courses)
     */
    fun notifySessionPurchase(enrollmentId: UUID, sessionCount: Int, courseId: UUID) {
        val destination = "/topic/admin/session-purchases"
        val message = SessionPurchaseEvent(
            enrollmentId = enrollmentId.toString(),
            courseId = courseId.toString(),
            sessionCount = sessionCount,
            timestamp = System.currentTimeMillis()
        )

        try {
            messagingTemplate.convertAndSend(destination, message)
            logger.info("✅ WebSocket session purchase notification sent: $destination → enrollmentId=$enrollmentId, sessions=$sessionCount")
        } catch (e: Exception) {
            logger.error("❌ Failed to send WebSocket session purchase notification to $destination", e)
            // Don't throw - payment processing should continue even if WebSocket fails
        }
    }

    /**
     * Notify admin/coach about pending cash payment
     *
     * Broadcasts notification to admin/coach when a parent initiates a cash payment
     * that requires manual confirmation. Coach must mark payment as received before
     * sessions are credited to the enrollment.
     *
     * @param enrollmentId Enrollment ID for which payment is pending
     * @param paymentId Payment ID that needs confirmation
     * @param sessionCount Number of sessions requested (will be credited after confirmation)
     * @param courseId Course ID for filtering (coaches only see their courses)
     */
    fun notifyPendingCashPayment(enrollmentId: UUID, paymentId: UUID, sessionCount: Int, courseId: UUID) {
        val destination = "/topic/admin/pending-cash-payments"
        val message = PendingCashPaymentEvent(
            enrollmentId = enrollmentId.toString(),
            paymentId = paymentId.toString(),
            courseId = courseId.toString(),
            sessionCount = sessionCount,
            timestamp = System.currentTimeMillis()
        )

        try {
            messagingTemplate.convertAndSend(destination, message)
            logger.info("✅ WebSocket pending cash payment notification sent: $destination → enrollmentId=$enrollmentId, paymentId=$paymentId, sessions=$sessionCount")
        } catch (e: Exception) {
            logger.error("❌ Failed to send WebSocket pending cash payment notification to $destination", e)
            // Don't throw - payment processing should continue even if WebSocket fails
        }
    }
    /**
     * Notify admin/coach about pending cash payment for an activity
     *
     * Broadcasts notification to admin/coach when a parent initiates a cash payment
     * for an activity that requires manual confirmation.
     *
     * @param enrollmentId Enrollment ID for which payment is pending
     * @param paymentId Payment ID that needs confirmation
     * @param activityId Activity ID for filtering
     * @param childName Name of the enrolled child
     * @param activityName Name of the activity
     */
    fun notifyPendingActivityCashPayment(
        enrollmentId: UUID,
        paymentId: UUID,
        activityId: UUID,
        childName: String,
        activityName: String
    ) {
        val destination = "/topic/admin/pending-activity-payments"
        val message = PendingActivityCashPaymentEvent(
            enrollmentId = enrollmentId.toString(),
            paymentId = paymentId.toString(),
            activityId = activityId.toString(),
            childName = childName,
            activityName = activityName,
            timestamp = System.currentTimeMillis()
        )

        try {
            messagingTemplate.convertAndSend(destination, message)
            logger.info("✅ WebSocket pending activity cash payment notification sent: $destination → enrollmentId=$enrollmentId, activityId=$activityId")
        } catch (e: Exception) {
            logger.error("❌ Failed to send WebSocket pending activity cash payment notification to $destination", e)
        }
    }

    /**
     * Test method to verify WebSocket connectivity
     *
     * Can be called from a REST endpoint to test if WebSocket infrastructure is working.
     * Useful for debugging and health checks.
     *
     * @param userId User ID to send test message to
     */
    fun sendTestNotification(userId: UUID) {
        val destination = "/topic/user/$userId/payments"
        val message = mapOf(
            "type" to "TEST",
            "message" to "WebSocket connection working",
            "timestamp" to System.currentTimeMillis()
        )

        try {
            messagingTemplate.convertAndSend(destination, message)
            logger.info("✅ WebSocket test notification sent: $destination")
        } catch (e: Exception) {
            logger.error("❌ Failed to send WebSocket test notification to $destination", e)
            throw e // Throw for test endpoint to report failure
        }
    }
}

/**
 * Event sent when enrollment is successfully activated after payment
 *
 * @property enrollmentId Enrollment UUID as string
 * @property status Enrollment status (always "ACTIVE" for this event)
 * @property timestamp Unix timestamp in milliseconds when event was created
 */
data class EnrollmentReadyEvent(
    val enrollmentId: String,
    val status: String,
    val timestamp: Long
)

/**
 * Event sent when payment fails
 *
 * @property enrollmentId Enrollment UUID as string
 * @property reason Failure reason from Stripe payment error
 * @property timestamp Unix timestamp in milliseconds when event was created
 */
data class PaymentFailedEvent(
    val enrollmentId: String,
    val reason: String,
    val timestamp: Long
)

/**
 * Event sent when parent purchases additional sessions
 *
 * Broadcast to all admin/coach users for real-time attendance panel updates
 *
 * @property enrollmentId Enrollment UUID as string
 * @property courseId Course UUID as string (for coach filtering)
 * @property sessionCount Number of sessions purchased
 * @property timestamp Unix timestamp in milliseconds when event was created
 */
data class SessionPurchaseEvent(
    val enrollmentId: String,
    val courseId: String,
    val sessionCount: Int,
    val timestamp: Long
)

/**
 * Event sent when parent initiates cash payment that requires coach confirmation
 *
 * Broadcast to admin/coach users to notify them a payment is pending manual confirmation
 *
 * @property enrollmentId Enrollment UUID as string
 * @property paymentId Payment UUID as string (for marking as paid)
 * @property courseId Course UUID as string (for coach filtering)
 * @property sessionCount Number of sessions that will be credited after confirmation
 * @property timestamp Unix timestamp in milliseconds when event was created
 */
data class PendingCashPaymentEvent(
    val enrollmentId: String,
    val paymentId: String,
    val courseId: String,
    val sessionCount: Int,
    val timestamp: Long
)

/**
 * Event sent when parent initiates cash payment for an activity
 *
 * Broadcast to admin/coach users to notify them a payment is pending manual confirmation
 *
 * @property enrollmentId Enrollment UUID as string
 * @property paymentId Payment UUID as string (for marking as paid)
 * @property activityId Activity UUID as string (for coach filtering)
 * @property childName Name of the enrolled child
 * @property activityName Name of the activity
 * @property timestamp Unix timestamp in milliseconds when event was created
 */
data class PendingActivityCashPaymentEvent(
    val enrollmentId: String,
    val paymentId: String,
    val activityId: String,
    val childName: String,
    val activityName: String,
    val timestamp: Long
)
