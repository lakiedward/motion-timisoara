package com.club.triathlon.config

import com.stripe.Stripe
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.context.annotation.Configuration
import jakarta.annotation.PostConstruct

@Configuration
class StripeConfig(
    @Value("\${stripe.secret-key}") private val secretKey: String
) {
    private val logger = LoggerFactory.getLogger(StripeConfig::class.java)

    @PostConstruct
    fun init() {
        if (secretKey == "NOT_CONFIGURED" || secretKey.isBlank()) {
            logger.warn("⚠️ Stripe is NOT CONFIGURED - Payment endpoints will not work")
            logger.info("To enable Stripe payments, set STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET environment variables")
        } else {
            Stripe.apiKey = secretKey
            logger.info("✅ Stripe configured successfully")
        }
    }
}
