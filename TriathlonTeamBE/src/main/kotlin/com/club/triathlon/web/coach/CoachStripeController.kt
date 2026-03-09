package com.club.triathlon.web.coach

import com.club.triathlon.repo.CoachProfileRepository
import com.club.triathlon.security.UserPrincipal
import com.club.triathlon.service.StripeAccountStatus
import com.club.triathlon.service.StripeConnectService
import io.swagger.v3.oas.annotations.Operation
import io.swagger.v3.oas.annotations.security.SecurityRequirement
import io.swagger.v3.oas.annotations.tags.Tag
import org.slf4j.LoggerFactory
import org.springframework.security.access.prepost.PreAuthorize
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/coach/stripe")
@PreAuthorize("hasRole('COACH')")
@Tag(name = "Coach - Stripe", description = "Coach Stripe Connect management")
class CoachStripeController(
    private val stripeConnectService: StripeConnectService,
    private val coachProfileRepository: CoachProfileRepository
) {
    private val logger = LoggerFactory.getLogger(CoachStripeController::class.java)

    @GetMapping("/status")
    @Operation(
        summary = "Get Stripe account status",
        description = "Get the current status of the coach's Stripe Connect account",
        security = [SecurityRequirement(name = "bearerAuth")]
    )
    fun getAccountStatus(
        @AuthenticationPrincipal principal: UserPrincipal
    ): StripeAccountStatusResponse {
        logger.info("📊 [COACH] Getting Stripe status for: ${principal.user.email}")
        
        val status = stripeConnectService.refreshAccountStatus(principal.user.id!!)
        val coachCanReceivePayments = status.onboardingComplete && status.chargesEnabled
        
        // Check if coach belongs to a club with Stripe configured (fallback)
        val profile = coachProfileRepository.findByUser(principal.user)
        val clubWithStripe = profile?.clubs?.firstOrNull { it.canReceivePayments() }
        
        // Determine payment destination
        val paymentDestination = when {
            coachCanReceivePayments -> "COACH"
            clubWithStripe != null -> "CLUB"
            else -> "NONE"
        }
        
        return StripeAccountStatusResponse(
            hasAccount = status.hasAccount,
            onboardingComplete = status.onboardingComplete,
            chargesEnabled = status.chargesEnabled,
            payoutsEnabled = status.payoutsEnabled,
            requiresAction = status.requiresAction,
            canReceivePayments = coachCanReceivePayments,
            // New fields for payment routing
            paymentDestination = paymentDestination,
            clubName = clubWithStripe?.name,
            clubCanReceivePayments = clubWithStripe?.canReceivePayments() ?: false
        )
    }

    @GetMapping("/onboarding-link")
    @Operation(
        summary = "Get onboarding link",
        description = "Generate a new Stripe Express onboarding link",
        security = [SecurityRequirement(name = "bearerAuth")]
    )
    fun getOnboardingLink(
        @AuthenticationPrincipal principal: UserPrincipal
    ): OnboardingLinkResponse {
        logger.info("🔗 [COACH] Generating onboarding link for: ${principal.user.email}")
        
        val url = stripeConnectService.generateOnboardingLink(principal.user.id!!)
        
        return OnboardingLinkResponse(url = url)
    }

    @GetMapping("/dashboard-link")
    @Operation(
        summary = "Get dashboard link",
        description = "Generate a link to the Stripe Express dashboard",
        security = [SecurityRequirement(name = "bearerAuth")]
    )
    fun getDashboardLink(
        @AuthenticationPrincipal principal: UserPrincipal
    ): DashboardLinkResponse {
        logger.info("📈 [COACH] Generating dashboard link for: ${principal.user.email}")
        
        val url = stripeConnectService.generateDashboardLink(principal.user.id!!)
        
        return DashboardLinkResponse(url = url)
    }

    @PostMapping("/refresh-status")
    @Operation(
        summary = "Refresh account status",
        description = "Refresh the Stripe account status from Stripe API",
        security = [SecurityRequirement(name = "bearerAuth")]
    )
    fun refreshStatus(
        @AuthenticationPrincipal principal: UserPrincipal
    ): StripeAccountStatusResponse {
        logger.info("🔄 [COACH] Refreshing Stripe status for: ${principal.user.email}")
        
        val status = stripeConnectService.refreshAccountStatus(principal.user.id!!)
        val coachCanReceivePayments = status.onboardingComplete && status.chargesEnabled
        
        // Check if coach belongs to a club with Stripe configured (fallback)
        val profile = coachProfileRepository.findByUser(principal.user)
        val clubWithStripe = profile?.clubs?.firstOrNull { it.canReceivePayments() }
        
        // Determine payment destination
        val paymentDestination = when {
            coachCanReceivePayments -> "COACH"
            clubWithStripe != null -> "CLUB"
            else -> "NONE"
        }
        
        return StripeAccountStatusResponse(
            hasAccount = status.hasAccount,
            onboardingComplete = status.onboardingComplete,
            chargesEnabled = status.chargesEnabled,
            payoutsEnabled = status.payoutsEnabled,
            requiresAction = status.requiresAction,
            canReceivePayments = coachCanReceivePayments,
            paymentDestination = paymentDestination,
            clubName = clubWithStripe?.name,
            clubCanReceivePayments = clubWithStripe?.canReceivePayments() ?: false
        )
    }
}

data class StripeAccountStatusResponse(
    val hasAccount: Boolean,
    val onboardingComplete: Boolean,
    val chargesEnabled: Boolean,
    val payoutsEnabled: Boolean,
    val requiresAction: Boolean,
    val canReceivePayments: Boolean,
    // Payment routing info
    val paymentDestination: String, // "COACH", "CLUB", or "NONE"
    val clubName: String? = null,
    val clubCanReceivePayments: Boolean = false
)

data class OnboardingLinkResponse(
    val url: String
)

data class DashboardLinkResponse(
    val url: String
)
