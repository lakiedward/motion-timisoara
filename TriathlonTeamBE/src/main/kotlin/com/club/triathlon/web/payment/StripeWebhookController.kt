package com.club.triathlon.web.payment

import com.club.triathlon.service.payment.PaymentService
import com.club.triathlon.service.payment.StripeWebhookResult
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestHeader
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/webhooks/stripe")
class StripeWebhookController(
    private val paymentService: PaymentService
) {

    @PostMapping
    fun handleWebhook(
        @RequestBody body: String,
        @RequestHeader("Stripe-Signature") signature: String?
    ): ResponseEntity<StripeWebhookResult> {
        val result = paymentService.handleWebhook(body, signature)
        return ResponseEntity.ok(result)
    }
}