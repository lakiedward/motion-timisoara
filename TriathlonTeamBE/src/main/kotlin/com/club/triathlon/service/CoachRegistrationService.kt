package com.club.triathlon.service

import com.club.triathlon.domain.Club
import com.club.triathlon.domain.CoachProfile
import com.club.triathlon.domain.User
import com.club.triathlon.enums.Role
import com.club.triathlon.repo.ClubRepository
import com.club.triathlon.repo.CoachProfileRepository
import com.club.triathlon.repo.SportRepository
import com.club.triathlon.repo.UserRepository
import com.club.triathlon.security.JwtService
import com.club.triathlon.util.PhotoUtils
import org.slf4j.LoggerFactory
import org.springframework.http.HttpStatus
import org.springframework.security.crypto.password.PasswordEncoder
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.server.ResponseStatusException
import java.time.OffsetDateTime
import java.util.UUID

@Service
class CoachRegistrationService(
    private val userRepository: UserRepository,
    private val coachProfileRepository: CoachProfileRepository,
    private val sportRepository: SportRepository,
    private val invitationCodeService: InvitationCodeService,
    private val clubInvitationCodeService: ClubInvitationCodeService,
    private val clubRepository: ClubRepository,
    private val stripeConnectService: StripeConnectService,
    private val passwordEncoder: PasswordEncoder,
    private val jwtService: JwtService
) {
    private val logger = LoggerFactory.getLogger(CoachRegistrationService::class.java)

    @Transactional
    fun registerCoach(request: RegisterCoachRequest): CoachRegistrationResult {
        logger.info("🏃 Starting coach registration for email: ${request.email}")

        // 1. Check email not taken
        if (userRepository.existsByEmail(request.email)) {
            logger.warn("❌ Registration failed - email already exists: ${request.email}")
            throw ResponseStatusException(HttpStatus.CONFLICT, "Email deja înregistrat")
        }

        // 2. Create user with COACH role (but don't save yet - we need to validate invitation code first)
        val user = User().apply {
            email = request.email
            passwordHash = passwordEncoder.encode(request.password)
            name = request.name
            phone = request.phone
            role = Role.COACH
            createdAt = OffsetDateTime.now()
            enabled = true
        }
        val savedUser = userRepository.save(user)

        // 3. Validate invitation code first (without consuming)
        val clubCodeValidation = clubInvitationCodeService.validateCode(request.invitationCode)
        val isClubCode = clubCodeValidation.valid
        
        // If not a valid club code, validate as admin code
        if (!isClubCode) {
            try {
                // This will throw if invalid
                invitationCodeService.validateCode(request.invitationCode)
            } catch (e: Exception) {
                userRepository.delete(savedUser)
                throw e
            }
        }

        // 4. Resolve sports from IDs
        val sports = if (request.sportIds.isNullOrEmpty()) {
            mutableSetOf()
        } else {
            sportRepository.findAllById(request.sportIds).toMutableSet()
        }

        // 5. Create coach profile
        val coachProfile = CoachProfile().apply {
            this.user = savedUser
            this.bio = request.bio
            this.sports = sports
            
            // Company info
            this.hasCompany = request.hasCompany
            this.companyName = request.companyName
            this.companyCui = request.companyCui
            this.companyRegNumber = request.companyRegNumber
            this.companyAddress = request.companyAddress
            this.bankAccount = request.bankAccount
            this.bankName = request.bankName

            // Process photo if provided
            request.photo?.let { base64Photo ->
                val photoData = PhotoUtils.processPhoto(base64Photo)
                this.photo = photoData.first
                this.photoContentType = photoData.second
            }
        }
        val savedCoachProfile = coachProfileRepository.save(coachProfile)

        // 6. Consume invitation code and associate with club if applicable
        var associatedClub: Club? = null
        try {
            if (isClubCode) {
                // Use ClubInvitationCodeService to properly mark usedByCoach and associate
                associatedClub = clubInvitationCodeService.validateAndUseCode(request.invitationCode, savedCoachProfile)
                logger.info("✅ Coach ${savedUser.email} associated with club ${associatedClub.name}")
            } else {
                // Use admin invitation code
                invitationCodeService.validateAndUseCode(request.invitationCode, savedUser)
            }
        } catch (e: Exception) {
            // Rollback if code consumption fails
            coachProfileRepository.delete(savedCoachProfile)
            userRepository.delete(savedUser)
            throw e
        }

        // 7. Create Stripe Express account
        var stripeAccountId: String? = null
        var stripeOnboardingUrl: String? = null
        
        try {
            if (stripeConnectService.isStripeConfigured()) {
                stripeAccountId = stripeConnectService.createExpressAccount(savedUser.id!!, request.email)
                stripeOnboardingUrl = stripeConnectService.generateOnboardingLink(savedUser.id!!)
                logger.info("✅ Stripe account created for coach: $stripeAccountId")
            } else {
                logger.warn("⚠️ Stripe not configured - coach registered without Stripe account")
            }
        } catch (e: Exception) {
            logger.error("❌ Failed to create Stripe account for coach ${savedUser.id}: ${e.message}", e)
            // Don't fail registration if Stripe fails - coach can set it up later
        }

        logger.info("✅ Coach registration completed for: ${savedUser.email}, ID: ${savedUser.id}")

        return CoachRegistrationResult(
            userId = savedUser.id!!,
            email = savedUser.email,
            name = savedUser.name,
            stripeAccountId = stripeAccountId,
            stripeOnboardingUrl = stripeOnboardingUrl,
            requiresStripeOnboarding = stripeOnboardingUrl != null
        )
    }

    /**
     * Validate invitation code without using it (for form validation)
     */
    fun validateInvitationCode(code: String): InvitationCodeValidation {
        // Check club codes first
        val clubValidation = clubInvitationCodeService.validateCode(code)
        if (clubValidation.valid) {
            return InvitationCodeValidation(
                valid = true,
                message = clubValidation.message,
                clubName = clubValidation.clubName
            )
        }
        
        // Check admin codes
        return try {
            invitationCodeService.validateCode(code)
            InvitationCodeValidation(
                valid = true,
                message = "Cod valid",
                clubName = null
            )
        } catch (e: Exception) {
            InvitationCodeValidation(
                valid = false,
                message = e.message ?: "Cod invalid",
                clubName = null
            )
        }
    }
}

data class RegisterCoachRequest(
    val name: String,
    val email: String,
    val password: String,
    val phone: String?,
    val invitationCode: String,
    val bio: String? = null,
    val sportIds: List<UUID>? = null,
    val photo: String? = null,
    // Company info (optional)
    val hasCompany: Boolean = false,
    val companyName: String? = null,
    val companyCui: String? = null,
    val companyRegNumber: String? = null,
    val companyAddress: String? = null,
    val bankAccount: String? = null,
    val bankName: String? = null
)

data class CoachRegistrationResult(
    val userId: UUID,
    val email: String,
    val name: String,
    val stripeAccountId: String?,
    val stripeOnboardingUrl: String?,
    val requiresStripeOnboarding: Boolean
)

data class InvitationCodeValidation(
    val valid: Boolean,
    val message: String,
    val clubName: String? = null
)
