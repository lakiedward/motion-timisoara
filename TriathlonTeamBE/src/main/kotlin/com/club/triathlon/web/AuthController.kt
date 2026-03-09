package com.club.triathlon.web

import com.club.triathlon.domain.User
import com.club.triathlon.enums.Role
import com.club.triathlon.repo.UserRepository
import com.club.triathlon.security.AuthCookieService
import com.club.triathlon.security.JwtService
import com.club.triathlon.security.UserPrincipal
import com.club.triathlon.service.ClubInvitationCodeService
import com.club.triathlon.service.ClubRegistrationService
import com.club.triathlon.service.CoachRegistrationService
import com.club.triathlon.service.PasswordResetService
import com.club.triathlon.service.RegisterClubRequest
import com.club.triathlon.service.RegisterCoachRequest
import jakarta.validation.Valid
import jakarta.validation.constraints.Email
import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.Pattern
import jakarta.validation.constraints.Size
import org.slf4j.LoggerFactory
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.security.authentication.AuthenticationManager
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.security.crypto.password.PasswordEncoder
import org.springframework.validation.annotation.Validated
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PatchMapping
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController
import java.time.OffsetDateTime
import java.util.UUID

@RestController
@RequestMapping("/api/auth")
@Validated
class AuthController(
    private val userRepository: UserRepository,
    private val passwordEncoder: PasswordEncoder,
    private val jwtService: JwtService,
    private val authenticationManager: AuthenticationManager,
    private val authCookieService: AuthCookieService,
    private val passwordResetService: PasswordResetService,
    private val coachRegistrationService: CoachRegistrationService,
    private val clubRegistrationService: ClubRegistrationService,
    private val clubInvitationCodeService: ClubInvitationCodeService
) {
    
    private val logger = LoggerFactory.getLogger(AuthController::class.java)

    @PostMapping("/register-parent")
    fun registerParent(
        @Valid @RequestBody request: RegisterParentRequest,
        response: jakarta.servlet.http.HttpServletResponse
    ): ResponseEntity<AuthResponse> {
        logger.info(" [AUTH] Parent registration attempt for email: ${request.email}")
        
        if (userRepository.existsByEmail(request.email)) {
            logger.warn(" [AUTH] Registration failed - email already exists: ${request.email}")
            throw IllegalArgumentException("Email already registered")
        }

        val user = User().apply {
            email = request.email
            passwordHash = passwordEncoder.encode(request.password)
            name = request.name
            phone = request.phone
            role = Role.PARENT
            createdAt = OffsetDateTime.now()
        }

        val saved = userRepository.save(user)
        val accessToken = jwtService.generateToken(saved)
        val refreshToken = jwtService.createRefreshToken(saved)

        // Set HttpOnly cookies for both access and refresh tokens
        authCookieService.writeAuthCookies(response, accessToken, refreshToken.token)

        logger.info(" [AUTH] Parent registration successful for email: ${request.email}, user ID: ${saved.id}")
        return ResponseEntity.status(HttpStatus.CREATED).body(AuthResponse(user.toSummary()))
    }

    @PostMapping("/login")
    fun login(
        @Valid @RequestBody request: LoginRequest,
        response: jakarta.servlet.http.HttpServletResponse
    ): AuthResponse {
        logger.info(" [AUTH] Login attempt for email: ${request.email}")
        
        try {
            authenticationManager.authenticate(
                UsernamePasswordAuthenticationToken(request.email, request.password)
            )

            val user = userRepository.findByEmail(request.email)
                .orElseThrow { IllegalArgumentException("Invalid credentials") }

            val accessToken = jwtService.generateToken(user)
            val refreshToken = jwtService.createRefreshToken(user)

            // Clear any existing cookies first to ensure clean state
            authCookieService.clearAuthCookies(response)

            // Set HttpOnly cookies for both access and refresh tokens
            authCookieService.writeAuthCookies(response, accessToken, refreshToken.token)

            logger.info(" [AUTH] Login successful for email: ${request.email}, role: ${user.role}")
            return AuthResponse(user.toSummary())
        } catch (ex: Exception) {
            logger.warn(" [AUTH] Login failed for email: ${request.email}, reason: ${ex.message}")
            throw ex
        }
    }

    @GetMapping("/me")
    fun me(@AuthenticationPrincipal principal: UserPrincipal): UserSummary {
        logger.info(" [AUTH] User profile request for: ${principal.user.email}")
        return principal.user.toSummary()
    }
    
    @PatchMapping("/complete-profile")
    fun completeProfile(
        @AuthenticationPrincipal principal: UserPrincipal,
        @Valid @RequestBody request: CompleteProfileRequest
    ): UserSummary {
        val user = principal.user
        logger.info(" [AUTH] Completing profile for user: ${user.email}")

        user.phone = request.phone
        if (!request.name.isNullOrBlank()) {
            user.name = request.name
        }

        val saved = userRepository.save(user)
        return saved.toSummary()
    }

    @PostMapping("/logout")
    fun logout(
        @AuthenticationPrincipal principal: UserPrincipal?,
        response: jakarta.servlet.http.HttpServletResponse
    ): ResponseEntity<Map<String, String>> {
        logger.info(" [AUTH] Logout request")

        // Revoke all refresh tokens for this user (logout from all devices)
        principal?.let {
            jwtService.revokeAllUserTokens(it.user)
            logger.info("Revoked all refresh tokens for user: ${it.user.email}")
        }

        // Clear cookies
        authCookieService.clearAuthCookies(response)

        return ResponseEntity.ok(mapOf("message" to "Logged out successfully"))
    }

    @PostMapping("/refresh")
    fun refresh(
        request: jakarta.servlet.http.HttpServletRequest,
        response: jakarta.servlet.http.HttpServletResponse
    ): ResponseEntity<RefreshResponse> {
        logger.info(" [AUTH] Token refresh request")

        // Get refresh token from cookie
        val refreshTokenString = request.cookies?.find { it.name == "refresh_token" }?.value
            ?: throw IllegalArgumentException("Refresh token not found")

        // Validate and consume refresh token (one-time use)
        val user = jwtService.validateAndConsumeRefreshToken(refreshTokenString)
            ?: throw IllegalArgumentException("Invalid or expired refresh token")

        // Generate new tokens
        val newAccessToken = jwtService.generateToken(user)
        val newRefreshToken = jwtService.createRefreshToken(user)

        // Set new cookies
        authCookieService.writeAuthCookies(response, newAccessToken, newRefreshToken.token)

        logger.info(" [AUTH] Token refresh successful for user: ${user.email}")
        return ResponseEntity.ok(RefreshResponse(user = user.toSummary()))
    }

    @PostMapping("/forgot-password")
    fun forgotPassword(
        @Valid @RequestBody request: ForgotPasswordRequest
    ): ResponseEntity<Map<String, String>> {
        logger.info(" [AUTH] Password reset requested for email: ${request.email}")
        passwordResetService.requestReset(request.email)
        return ResponseEntity.ok(
            mapOf(
                "message" to "Daca adresa exista in sistem, vei primi un email cu instructiuni de resetare a parolei."
            )
        )
    }

    @PostMapping("/reset-password")
    fun resetPassword(
        @Valid @RequestBody request: ResetPasswordRequest
    ): ResponseEntity<Map<String, String>> {
        logger.info(" [AUTH] Password reset attempt with token")
        return try {
            passwordResetService.resetPassword(request.token, request.newPassword)
            ResponseEntity.ok(mapOf("message" to "Parola a fost resetata cu succes."))
        } catch (ex: IllegalArgumentException) {
            logger.warn(" [AUTH] Password reset failed: ${ex.message}")
            ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(mapOf("message" to (ex.message ?: "Token invalid sau expirat")))
        }
    }

    @PostMapping("/register-coach")
    fun registerCoach(
        @Valid @RequestBody request: RegisterCoachApiRequest,
        response: jakarta.servlet.http.HttpServletResponse
    ): ResponseEntity<CoachRegistrationResponse> {
        logger.info(" [AUTH] Coach registration attempt for email: ${request.email}")

        val result = coachRegistrationService.registerCoach(
            RegisterCoachRequest(
                name = request.name,
                email = request.email,
                password = request.password,
                phone = request.phone,
                invitationCode = request.invitationCode,
                bio = request.bio,
                sportIds = request.sportIds,
                hasCompany = request.hasCompany,
                companyName = request.companyName,
                companyCui = request.companyCui,
                companyRegNumber = request.companyRegNumber,
                companyAddress = request.companyAddress,
                bankAccount = request.bankAccount,
                bankName = request.bankName
            )
        )

        // Generate tokens for immediate login
        val user = userRepository.findById(result.userId).orElseThrow()
        val accessToken = jwtService.generateToken(user)
        val refreshToken = jwtService.createRefreshToken(user)

        authCookieService.writeAuthCookies(response, accessToken, refreshToken.token)

        logger.info(" [AUTH] Coach registration successful for email: ${request.email}, ID: ${result.userId}")

        return ResponseEntity.status(HttpStatus.CREATED).body(
            CoachRegistrationResponse(
                user = user.toSummary(),
                stripeOnboardingUrl = result.stripeOnboardingUrl,
                requiresStripeOnboarding = result.requiresStripeOnboarding
            )
        )
    }

    @PostMapping("/register-club")
    fun registerClub(
        @Valid @RequestBody request: RegisterClubApiRequest,
        response: jakarta.servlet.http.HttpServletResponse
    ): ResponseEntity<ClubRegistrationResponse> {
        logger.info(" [AUTH] Club registration attempt for email: ${request.email}")

        val result = clubRegistrationService.registerClub(
            RegisterClubRequest(
                ownerName = request.ownerName,
                email = request.email,
                password = request.password,
                phone = request.phone,
                clubName = request.clubName,
                description = request.description,
                clubPhone = request.clubPhone,
                clubEmail = request.clubEmail,
                address = request.address,
                city = request.city,
                website = request.website,
                sportIds = request.sportIds
            )
        )

        // Generate tokens for immediate login
        val user = userRepository.findById(result.userId).orElseThrow()
        val accessToken = jwtService.generateToken(user)
        val refreshToken = jwtService.createRefreshToken(user)

        authCookieService.writeAuthCookies(response, accessToken, refreshToken.token)

        logger.info(" [AUTH] Club registration successful for: ${result.clubName}, ID: ${result.clubId}")

        return ResponseEntity.status(HttpStatus.CREATED).body(
            ClubRegistrationResponse(
                user = user.toSummary(),
                clubId = result.clubId,
                clubName = result.clubName,
                stripeOnboardingUrl = result.stripeOnboardingUrl,
                requiresStripeOnboarding = result.requiresStripeOnboarding
            )
        )
    }

    @GetMapping("/csrf")
    fun csrf(token: org.springframework.security.web.csrf.CsrfToken): Map<String, String> =
        mapOf("token" to token.token)

    @PostMapping("/validate-club-code")
    fun validateClubCode(
        @Valid @RequestBody request: ValidateClubCodeRequest
    ): ResponseEntity<ClubCodeValidationResponse> {
        logger.info(" [AUTH] Validating club invitation code")
        val validation = clubInvitationCodeService.validateCode(request.code)
        return ResponseEntity.ok(
            ClubCodeValidationResponse(
                valid = validation.valid,
                message = validation.message,
                clubName = validation.clubName
            )
        )
    }
}

data class RegisterParentRequest(
    @field:NotBlank
    val name: String,
    @field:NotBlank
    @field:Email
    val email: String,
    @field:NotBlank
    @field:Size(min = 6)
    val password: String,
    val phone: String?
)

data class LoginRequest(
    @field:NotBlank
    @field:Email
    val email: String,
    @field:NotBlank
    val password: String
)

data class AuthResponse(
    val user: UserSummary
)

data class RefreshResponse(
    val user: UserSummary? = null
)

data class UserSummary(
    val id: UUID,
    val name: String,
    val email: String,
    val role: Role,
    val phone: String?,
    val oauthProvider: String?,
    val avatarUrl: String?,
    val needsProfileCompletion: Boolean
)

private fun User.toSummary(): UserSummary = UserSummary(
    id = this.id ?: throw IllegalStateException("User id is not set"),
    name = this.name,
    email = this.email,
    role = this.role,
    phone = this.phone,
    oauthProvider = this.oauthProvider,
    avatarUrl = this.avatarUrl,
    needsProfileCompletion = this.requiresProfileCompletion()
)

data class CompleteProfileRequest(
    @field:NotBlank
    @field:Pattern(regexp = "^\\+?[0-9]{8,15}$")
    val phone: String,
    @field:Size(min = 3)
    val name: String? = null
)

data class ForgotPasswordRequest(
    @field:NotBlank
    @field:Email
    val email: String
)

data class ResetPasswordRequest(
    @field:NotBlank
    val token: String,
    @field:NotBlank
    @field:Size(min = 6)
    val newPassword: String
)

// Coach Registration DTOs
data class RegisterCoachApiRequest(
    @field:NotBlank
    val name: String,
    @field:NotBlank
    @field:Email
    val email: String,
    @field:NotBlank
    @field:Size(min = 6)
    val password: String,
    val phone: String?,
    @field:NotBlank
    val invitationCode: String,
    val bio: String? = null,
    val sportIds: List<UUID>? = null,
    // Company info (optional for coaches)
    val hasCompany: Boolean = false,
    val companyName: String? = null,
    val companyCui: String? = null,
    val companyRegNumber: String? = null,
    val companyAddress: String? = null,
    val bankAccount: String? = null,
    val bankName: String? = null
)

data class CoachRegistrationResponse(
    val user: UserSummary,
    val stripeOnboardingUrl: String?,
    val requiresStripeOnboarding: Boolean
)

// Club Registration DTOs
data class RegisterClubApiRequest(
    // Owner info
    @field:NotBlank
    val ownerName: String,
    @field:NotBlank
    @field:Email
    val email: String,
    @field:NotBlank
    @field:Size(min = 6)
    val password: String,
    val phone: String?,
    
    // Club info
    @field:NotBlank
    val clubName: String,
    val description: String? = null,
    val clubPhone: String? = null,
    val clubEmail: String? = null,
    val address: String? = null,
    val city: String? = null,
    val website: String? = null,
    val sportIds: List<UUID>? = null
)

data class ClubRegistrationResponse(
    val user: UserSummary,
    val clubId: UUID,
    val clubName: String,
    val stripeOnboardingUrl: String?,
    val requiresStripeOnboarding: Boolean
)

data class ValidateClubCodeRequest(
    @field:NotBlank
    val code: String
)

data class ClubCodeValidationResponse(
    val valid: Boolean,
    val message: String,
    val clubName: String?
)