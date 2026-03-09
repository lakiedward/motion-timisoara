package com.club.triathlon.web.payment

import com.club.triathlon.service.StripeConnectService
import com.stripe.exception.SignatureVerificationException
import com.stripe.model.Account
import com.stripe.net.Webhook
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestHeader
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController
import org.springframework.web.server.ResponseStatusException

@RestController
@RequestMapping("/api/webhooks/stripe/connect")
class StripeConnectWebhookController(
    private val stripeConnectService: StripeConnectService,
    @Value("\${stripe.connect-webhook-secret:NOT_CONFIGURED}") private val connectWebhookSecret: String
) {
    private val logger = LoggerFactory.getLogger(StripeConnectWebhookController::class.java)

    @PostMapping
    fun handleConnectWebhook(
        @RequestBody payload: String,
        @RequestHeader("Stripe-Signature") signature: String?
    ): ResponseEntity<ConnectWebhookResult> {
        if (connectWebhookSecret == "NOT_CONFIGURED") {
            logger.warn("⚠️ Stripe Connect webhook secret not configured")
            return ResponseEntity.ok(ConnectWebhookResult("ignored", "Webhook secret not configured"))
        }

        if (signature == null) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Missing Stripe-Signature header")
        }

        val event = try {
            Webhook.constructEvent(payload, signature, connectWebhookSecret)
        } catch (e: SignatureVerificationException) {
            logger.warn("❌ Invalid Stripe Connect webhook signature")
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid signature")
        }

        logger.info("🔔 [STRIPE CONNECT] Webhook received: type={} id={}", event.type, event.id)

        when (event.type) {
            "account.updated" -> handleAccountUpdated(event)
            "account.application.authorized" -> handleAccountAuthorized(event)
            "account.application.deauthorized" -> handleAccountDeauthorized(event)
            else -> logger.info("ℹ️ [STRIPE CONNECT] Unhandled event type: ${event.type}")
        }

        return ResponseEntity.ok(ConnectWebhookResult(event.type, "Processed"))
    }

    private fun handleAccountUpdated(event: com.stripe.model.Event) {
        val account = event.dataObjectDeserializer.`object`.orElse(null) as? Account
        if (account == null) {
            logger.warn("❌ Could not deserialize Account from event")
            return
        }

        logger.info(
            "📊 [STRIPE CONNECT] Account updated: id={} chargesEnabled={} payoutsEnabled={}",
            account.id, account.chargesEnabled, account.payoutsEnabled
        )

        stripeConnectService.handleAccountUpdate(account.id)
    }

    private fun handleAccountAuthorized(event: com.stripe.model.Event) {
        val account = event.dataObjectDeserializer.`object`.orElse(null) as? Account
        if (account == null) {
            logger.warn("❌ Could not deserialize Account from event")
            return
        }

        logger.info("✅ [STRIPE CONNECT] Account authorized: id={}", account.id)
        stripeConnectService.handleAccountUpdate(account.id)
    }

    private fun handleAccountDeauthorized(event: com.stripe.model.Event) {
        val account = event.dataObjectDeserializer.`object`.orElse(null) as? Account
        if (account == null) {
            logger.warn("❌ Could not deserialize Account from event")
            return
        }

        logger.warn("⚠️ [STRIPE CONNECT] Account deauthorized: id={}", account.id)
        // Coach disconnected their Stripe account - update status
        stripeConnectService.handleAccountUpdate(account.id)
    }
}

data class ConnectWebhookResult(
    val eventType: String,
    val status: String
)
