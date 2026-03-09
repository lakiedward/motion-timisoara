package com.club.triathlon.service

import com.club.triathlon.domain.Club
import com.club.triathlon.domain.CoachProfile
import com.club.triathlon.domain.User
import com.club.triathlon.repo.ClubRepository
import com.club.triathlon.repo.CoachProfileRepository
import com.club.triathlon.repo.UserRepository
import com.stripe.model.Account
import com.stripe.model.AccountLink
import com.stripe.param.AccountCreateParams
import com.stripe.param.AccountLinkCreateParams
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.http.HttpStatus
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.server.ResponseStatusException
import java.math.BigDecimal
import java.math.RoundingMode
import java.util.UUID

@Service
class StripeConnectService(
    private val coachProfileRepository: CoachProfileRepository,
    private val clubRepository: ClubRepository,
    private val userRepository: UserRepository,
    @Value("\${stripe.secret-key}") private val stripeSecretKey: String,
    @Value("\${app.frontend-url:http://localhost:4200}") private val frontendUrl: String
) {
    private val logger = LoggerFactory.getLogger(StripeConnectService::class.java)

    companion object {
        const val PLATFORM_FEE_PERCENT = 1.0       // 1%
        const val VAT_RATE = 0.19                  // 19% TVA Romania
        const val TOTAL_PLATFORM_FEE_PERCENT = 1.19 // 1% + TVA (1% * 1.19)
    }

    /**
     * Check if Stripe is properly configured
     */
    fun isStripeConfigured(): Boolean {
        return stripeSecretKey != "NOT_CONFIGURED" && stripeSecretKey.isNotBlank()
    }

    /**
     * Create Stripe Express account for coach during registration
     */
    @Transactional
    fun createExpressAccount(coachUserId: UUID, email: String): String {
        if (!isStripeConfigured()) {
            throw ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Stripe is not configured")
        }

        val user = userRepository.findById(coachUserId).orElseThrow {
            ResponseStatusException(HttpStatus.NOT_FOUND, "User not found")
        }

        val profile = coachProfileRepository.findByUser(user)
            ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "Coach profile not found")

        // Check if account already exists
        if (!profile.stripeAccountId.isNullOrBlank()) {
            logger.info("Stripe account already exists for coach $coachUserId: ${profile.stripeAccountId}")
            return profile.stripeAccountId!!
        }

        val params = AccountCreateParams.builder()
            .setType(AccountCreateParams.Type.EXPRESS)
            .setEmail(email)
            .setCountry("RO")
            .setCapabilities(
                AccountCreateParams.Capabilities.builder()
                    .setCardPayments(
                        AccountCreateParams.Capabilities.CardPayments.builder()
                            .setRequested(true)
                            .build()
                    )
                    .setTransfers(
                        AccountCreateParams.Capabilities.Transfers.builder()
                            .setRequested(true)
                            .build()
                    )
                    .build()
            )
            .setBusinessType(AccountCreateParams.BusinessType.INDIVIDUAL)
            .putMetadata("coach_user_id", coachUserId.toString())
            .putMetadata("platform", "triathlon-team")
            .build()

        val account = Account.create(params)

        // Save to coach profile
        profile.stripeAccountId = account.id
        profile.stripeOnboardingComplete = false
        profile.stripeChargesEnabled = false
        profile.stripePayoutsEnabled = false
        coachProfileRepository.save(profile)

        logger.info("✅ Created Stripe Express account ${account.id} for coach $coachUserId")
        return account.id
    }

    /**
     * Generate onboarding link for coach to complete Stripe setup
     */
    fun generateOnboardingLink(coachUserId: UUID): String {
        if (!isStripeConfigured()) {
            throw ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Stripe is not configured")
        }

        val user = userRepository.findById(coachUserId).orElseThrow {
            ResponseStatusException(HttpStatus.NOT_FOUND, "User not found")
        }

        val profile = coachProfileRepository.findByUser(user)
            ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "Coach profile not found")

        val accountId = profile.stripeAccountId
            ?: throw ResponseStatusException(HttpStatus.BAD_REQUEST, "No Stripe account for coach")

        val params = AccountLinkCreateParams.builder()
            .setAccount(accountId)
            .setRefreshUrl("$frontendUrl/stripe/onboarding/refresh")
            .setReturnUrl("$frontendUrl/stripe/onboarding/complete")
            .setType(AccountLinkCreateParams.Type.ACCOUNT_ONBOARDING)
            .build()

        val accountLink = AccountLink.create(params)
        logger.info("Generated Stripe onboarding link for coach $coachUserId")
        return accountLink.url
    }

    /**
     * Generate login link for coach to access their Stripe Express dashboard
     */
    fun generateDashboardLink(coachUserId: UUID): String {
        if (!isStripeConfigured()) {
            throw ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Stripe is not configured")
        }

        val user = userRepository.findById(coachUserId).orElseThrow {
            ResponseStatusException(HttpStatus.NOT_FOUND, "User not found")
        }

        val profile = coachProfileRepository.findByUser(user)
            ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "Coach profile not found")

        val accountId = profile.stripeAccountId
            ?: throw ResponseStatusException(HttpStatus.BAD_REQUEST, "No Stripe account for coach")

        val loginLink = com.stripe.model.LoginLink.createOnAccount(accountId, mapOf<String, Any>(), null)
        logger.info("Generated Stripe dashboard link for coach $coachUserId")
        return loginLink.url
    }

    /**
     * Check and update coach's Stripe account status
     */
    @Transactional
    fun refreshAccountStatus(coachUserId: UUID): StripeAccountStatus {
        if (!isStripeConfigured()) {
            return StripeAccountStatus(
                hasAccount = false,
                onboardingComplete = false,
                chargesEnabled = false,
                payoutsEnabled = false,
                requiresAction = false,
                accountId = null
            )
        }

        val user = userRepository.findById(coachUserId).orElseThrow {
            ResponseStatusException(HttpStatus.NOT_FOUND, "User not found")
        }

        val profile = coachProfileRepository.findByUser(user)
            ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "Coach profile not found")

        val accountId = profile.stripeAccountId
            ?: return StripeAccountStatus(
                hasAccount = false,
                onboardingComplete = false,
                chargesEnabled = false,
                payoutsEnabled = false,
                requiresAction = true,
                accountId = null
            )

        val account = Account.retrieve(accountId)

        profile.stripeChargesEnabled = account.chargesEnabled ?: false
        profile.stripePayoutsEnabled = account.payoutsEnabled ?: false
        profile.stripeOnboardingComplete = profile.stripeChargesEnabled && profile.stripePayoutsEnabled
        coachProfileRepository.save(profile)

        val requiresAction = !profile.stripeOnboardingComplete

        logger.info(
            "Stripe account status for coach $coachUserId: " +
            "charges=${profile.stripeChargesEnabled}, payouts=${profile.stripePayoutsEnabled}, " +
            "complete=${profile.stripeOnboardingComplete}"
        )

        return StripeAccountStatus(
            hasAccount = true,
            onboardingComplete = profile.stripeOnboardingComplete,
            chargesEnabled = profile.stripeChargesEnabled,
            payoutsEnabled = profile.stripePayoutsEnabled,
            requiresAction = requiresAction,
            accountId = accountId
        )
    }

    /**
     * Handle Stripe Connect webhook for account updates
     */
    @Transactional
    fun handleAccountUpdate(stripeAccountId: String) {
        val profile = coachProfileRepository.findAll()
            .find { it.stripeAccountId == stripeAccountId }
            ?: run {
                logger.warn("Received account.updated webhook for unknown account: $stripeAccountId")
                return
            }

        val account = Account.retrieve(stripeAccountId)

        profile.stripeChargesEnabled = account.chargesEnabled ?: false
        profile.stripePayoutsEnabled = account.payoutsEnabled ?: false
        profile.stripeOnboardingComplete = profile.stripeChargesEnabled && profile.stripePayoutsEnabled
        coachProfileRepository.save(profile)

        logger.info(
            "✅ Updated Stripe status for account $stripeAccountId: " +
            "charges=${profile.stripeChargesEnabled}, payouts=${profile.stripePayoutsEnabled}"
        )
    }

    /**
     * Calculate platform fee breakdown (1% + TVA = 1.19%)
     * @param amount Amount in smallest currency unit (bani for RON)
     * Uses BigDecimal for precise financial calculations with HALF_UP rounding
     */
    fun calculatePlatformFee(amount: Long): PlatformFeeBreakdown {
        val amountBD = BigDecimal.valueOf(amount)
        val feePercent = BigDecimal.valueOf(PLATFORM_FEE_PERCENT).divide(BigDecimal(100))
        val vatRate = BigDecimal.valueOf(VAT_RATE)

        // Base fee: 1% of total (rounded to nearest bani)
        val baseFee = amountBD.multiply(feePercent)
            .setScale(0, RoundingMode.HALF_UP)
            .toLong()

        // VAT on fee: 19% of the base fee (rounded to nearest bani)
        val vatOnFee = BigDecimal.valueOf(baseFee).multiply(vatRate)
            .setScale(0, RoundingMode.HALF_UP)
            .toLong()

        // Total platform fee
        val totalFee = baseFee + vatOnFee

        // Coach receives the rest (exact, no rounding needed)
        val coachAmount = amount - totalFee

        return PlatformFeeBreakdown(
            totalAmount = amount,
            platformFeeBase = baseFee,
            platformFeeVat = vatOnFee,
            platformFeeTotal = totalFee,
            coachAmount = coachAmount
        )
    }

    /**
     * Get coach's Stripe account ID if available and onboarding complete
     */
    fun getCoachStripeAccountId(coach: User): String? {
        val profile = coachProfileRepository.findByUser(coach) ?: return null
        
        if (!profile.stripeOnboardingComplete) {
            return null
        }
        
        return profile.stripeAccountId
    }

    /**
     * Delete a Stripe Connect account
     * This is called when admin deletes a coach
     */
    fun deleteAccount(stripeAccountId: String): Boolean {
        if (!isStripeConfigured()) {
            logger.warn("⚠️ Stripe not configured - cannot delete account")
            return false
        }

        return try {
            val account = Account.retrieve(stripeAccountId)
            account.delete()
            logger.info("🗑️ Deleted Stripe account: $stripeAccountId")
            true
        } catch (e: Exception) {
            logger.error("❌ Failed to delete Stripe account $stripeAccountId: ${e.message}")
            // Don't throw - we still want to delete the coach even if Stripe deletion fails
            false
        }
    }

    // ============================================
    // Club Stripe Connect Methods
    // ============================================

    /**
     * Create Stripe Express account for club during registration
     */
    @Transactional
    fun createExpressAccountForClub(clubId: UUID, email: String, businessName: String): String {
        if (!isStripeConfigured()) {
            throw ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Stripe is not configured")
        }

        val club = clubRepository.findById(clubId).orElseThrow {
            ResponseStatusException(HttpStatus.NOT_FOUND, "Club not found")
        }

        // Check if account already exists
        if (!club.stripeAccountId.isNullOrBlank()) {
            logger.info("Stripe account already exists for club $clubId: ${club.stripeAccountId}")
            return club.stripeAccountId!!
        }

        val params = AccountCreateParams.builder()
            .setType(AccountCreateParams.Type.EXPRESS)
            .setEmail(email)
            .setCountry("RO")
            .setBusinessProfile(
                AccountCreateParams.BusinessProfile.builder()
                    .setName(businessName)
                    .build()
            )
            .setCapabilities(
                AccountCreateParams.Capabilities.builder()
                    .setCardPayments(
                        AccountCreateParams.Capabilities.CardPayments.builder()
                            .setRequested(true)
                            .build()
                    )
                    .setTransfers(
                        AccountCreateParams.Capabilities.Transfers.builder()
                            .setRequested(true)
                            .build()
                    )
                    .build()
            )
            .setBusinessType(AccountCreateParams.BusinessType.COMPANY)
            .putMetadata("club_id", clubId.toString())
            .putMetadata("platform", "triathlon-team")
            .putMetadata("account_type", "club")
            .build()

        val account = Account.create(params)

        // Save to club
        club.stripeAccountId = account.id
        club.stripeOnboardingComplete = false
        club.stripeChargesEnabled = false
        club.stripePayoutsEnabled = false
        clubRepository.save(club)

        logger.info("✅ Created Stripe Express account ${account.id} for club $clubId")
        return account.id
    }

    /**
     * Generate onboarding link for club to complete Stripe setup
     */
    fun generateClubOnboardingLink(clubId: UUID): String {
        if (!isStripeConfigured()) {
            throw ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Stripe is not configured")
        }

        val club = clubRepository.findById(clubId).orElseThrow {
            ResponseStatusException(HttpStatus.NOT_FOUND, "Club not found")
        }

        val accountId = club.stripeAccountId
            ?: throw ResponseStatusException(HttpStatus.BAD_REQUEST, "No Stripe account for club")

        val params = AccountLinkCreateParams.builder()
            .setAccount(accountId)
            .setRefreshUrl("$frontendUrl/club/stripe/onboarding/refresh")
            .setReturnUrl("$frontendUrl/club/stripe/onboarding/complete")
            .setType(AccountLinkCreateParams.Type.ACCOUNT_ONBOARDING)
            .build()

        val accountLink = AccountLink.create(params)
        logger.info("Generated Stripe onboarding link for club $clubId")
        return accountLink.url
    }

    /**
     * Generate dashboard link for club to access their Stripe Express dashboard
     */
    fun generateClubDashboardLink(clubId: UUID): String {
        if (!isStripeConfigured()) {
            throw ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Stripe is not configured")
        }

        val club = clubRepository.findById(clubId).orElseThrow {
            ResponseStatusException(HttpStatus.NOT_FOUND, "Club not found")
        }

        val accountId = club.stripeAccountId
            ?: throw ResponseStatusException(HttpStatus.BAD_REQUEST, "No Stripe account for club")

        val loginLink = com.stripe.model.LoginLink.createOnAccount(accountId, mapOf<String, Any>(), null)
        logger.info("Generated Stripe dashboard link for club $clubId")
        return loginLink.url
    }

    /**
     * Check and update club's Stripe account status
     */
    @Transactional
    fun refreshClubAccountStatus(clubId: UUID): StripeAccountStatus {
        if (!isStripeConfigured()) {
            return StripeAccountStatus(
                hasAccount = false,
                onboardingComplete = false,
                chargesEnabled = false,
                payoutsEnabled = false,
                requiresAction = false,
                accountId = null
            )
        }

        val club = clubRepository.findById(clubId).orElseThrow {
            ResponseStatusException(HttpStatus.NOT_FOUND, "Club not found")
        }

        val accountId = club.stripeAccountId
            ?: return StripeAccountStatus(
                hasAccount = false,
                onboardingComplete = false,
                chargesEnabled = false,
                payoutsEnabled = false,
                requiresAction = true,
                accountId = null
            )

        val account = Account.retrieve(accountId)

        club.stripeChargesEnabled = account.chargesEnabled ?: false
        club.stripePayoutsEnabled = account.payoutsEnabled ?: false
        club.stripeOnboardingComplete = club.stripeChargesEnabled && club.stripePayoutsEnabled
        clubRepository.save(club)

        val requiresAction = !club.stripeOnboardingComplete

        logger.info(
            "Stripe account status for club $clubId: " +
            "charges=${club.stripeChargesEnabled}, payouts=${club.stripePayoutsEnabled}, " +
            "complete=${club.stripeOnboardingComplete}"
        )

        return StripeAccountStatus(
            hasAccount = true,
            onboardingComplete = club.stripeOnboardingComplete,
            chargesEnabled = club.stripeChargesEnabled,
            payoutsEnabled = club.stripePayoutsEnabled,
            requiresAction = requiresAction,
            accountId = accountId
        )
    }

    /**
     * Handle Stripe Connect webhook for club account updates
     */
    @Transactional
    fun handleClubAccountUpdate(stripeAccountId: String) {
        val club = clubRepository.findAll()
            .find { it.stripeAccountId == stripeAccountId }
            ?: run {
                logger.debug("Account $stripeAccountId is not a club account, checking coaches...")
                return
            }

        val account = Account.retrieve(stripeAccountId)

        club.stripeChargesEnabled = account.chargesEnabled ?: false
        club.stripePayoutsEnabled = account.payoutsEnabled ?: false
        club.stripeOnboardingComplete = club.stripeChargesEnabled && club.stripePayoutsEnabled
        clubRepository.save(club)

        logger.info(
            "✅ Updated Stripe status for club account $stripeAccountId: " +
            "charges=${club.stripeChargesEnabled}, payouts=${club.stripePayoutsEnabled}"
        )
    }

    /**
     * Get club's Stripe account ID if available and onboarding complete
     */
    fun getClubStripeAccountId(club: Club): String? {
        if (!club.stripeOnboardingComplete) {
            return null
        }
        return club.stripeAccountId
    }
}

data class StripeAccountStatus(
    val hasAccount: Boolean,
    val onboardingComplete: Boolean,
    val chargesEnabled: Boolean,
    val payoutsEnabled: Boolean,
    val requiresAction: Boolean,
    val accountId: String?
)

data class PlatformFeeBreakdown(
    val totalAmount: Long,
    val platformFeeBase: Long,
    val platformFeeVat: Long,
    val platformFeeTotal: Long,
    val coachAmount: Long
) {
    /**
     * Get fee percentage as human readable string
     */
    fun getFeePercentageDescription(): String = "1% + TVA (1.19% total)"
}
