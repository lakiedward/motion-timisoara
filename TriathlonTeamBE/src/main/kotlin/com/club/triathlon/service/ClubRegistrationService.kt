package com.club.triathlon.service

import com.club.triathlon.domain.Club
import com.club.triathlon.domain.User
import com.club.triathlon.enums.Role
import com.club.triathlon.repo.ClubRepository
import com.club.triathlon.repo.SportRepository
import com.club.triathlon.repo.UserRepository
import org.slf4j.LoggerFactory
import org.springframework.http.HttpStatus
import org.springframework.security.crypto.password.PasswordEncoder
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.server.ResponseStatusException
import java.time.OffsetDateTime
import java.util.UUID

@Service
class ClubRegistrationService(
    private val userRepository: UserRepository,
    private val clubRepository: ClubRepository,
    private val sportRepository: SportRepository,
    private val stripeConnectService: StripeConnectService,
    private val passwordEncoder: PasswordEncoder
) {
    private val logger = LoggerFactory.getLogger(ClubRegistrationService::class.java)

    @Transactional
    fun registerClub(request: RegisterClubRequest): ClubRegistrationResult {
        logger.info("🏢 Starting club registration for email: ${request.email}")

        // 1. Check email not taken
        if (userRepository.existsByEmail(request.email)) {
            logger.warn("❌ Registration failed - email already exists: ${request.email}")
            throw ResponseStatusException(HttpStatus.CONFLICT, "Email deja înregistrat")
        }

        // 2. Create user with CLUB role
        val user = User().apply {
            email = request.email
            passwordHash = passwordEncoder.encode(request.password)
            name = request.ownerName
            phone = request.phone
            role = Role.CLUB
            createdAt = OffsetDateTime.now()
            enabled = true
        }
        val savedUser = userRepository.save(user)

        // 3. Resolve sports from IDs
        val sports = if (request.sportIds.isNullOrEmpty()) {
            mutableSetOf()
        } else {
            sportRepository.findAllById(request.sportIds).toMutableSet()
        }

        // 4. Create club profile
        val club = Club().apply {
            this.owner = savedUser
            this.name = request.clubName
            this.description = request.description
            this.phone = request.clubPhone ?: request.phone
            this.email = request.clubEmail ?: request.email
            this.address = request.address
            this.city = request.city
            this.website = request.website
            this.sports = sports
            this.createdAt = OffsetDateTime.now()
        }
        clubRepository.save(club)

        // 5. Create Stripe Express account (required for clubs)
        var stripeAccountId: String? = null
        var stripeOnboardingUrl: String? = null
        
        try {
            if (stripeConnectService.isStripeConfigured()) {
                // Create Stripe account for the club
                stripeAccountId = stripeConnectService.createExpressAccountForClub(
                    clubId = club.id!!,
                    email = request.email,
                    businessName = request.clubName
                )
                
                // Update club with Stripe account ID
                club.stripeAccountId = stripeAccountId
                clubRepository.save(club)
                
                // Generate onboarding link
                stripeOnboardingUrl = stripeConnectService.generateClubOnboardingLink(club.id!!)
                logger.info("✅ Stripe account created for club: $stripeAccountId")
            } else {
                logger.warn("⚠️ Stripe not configured - club registered without Stripe account")
            }
        } catch (e: Exception) {
            logger.error("❌ Failed to create Stripe account for club ${club.id}: ${e.message}", e)
            // Don't fail registration if Stripe fails - club can set it up later
        }

        logger.info("✅ Club registration completed for: ${club.name}, ID: ${club.id}")

        return ClubRegistrationResult(
            userId = savedUser.id!!,
            clubId = club.id!!,
            email = savedUser.email,
            clubName = club.name,
            stripeAccountId = stripeAccountId,
            stripeOnboardingUrl = stripeOnboardingUrl,
            requiresStripeOnboarding = stripeOnboardingUrl != null || stripeAccountId == null
        )
    }
}

data class RegisterClubRequest(
    // Owner info
    val ownerName: String,
    val email: String,
    val password: String,
    val phone: String?,
    
    // Club info
    val clubName: String,
    val description: String? = null,
    val clubPhone: String? = null,
    val clubEmail: String? = null,
    val address: String? = null,
    val city: String? = null,
    val website: String? = null,
    val sportIds: List<UUID>? = null
)

data class ClubRegistrationResult(
    val userId: UUID,
    val clubId: UUID,
    val email: String,
    val clubName: String,
    val stripeAccountId: String?,
    val stripeOnboardingUrl: String?,
    val requiresStripeOnboarding: Boolean
)
