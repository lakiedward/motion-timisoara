package com.club.triathlon.security

import com.club.triathlon.domain.User
import com.club.triathlon.enums.Role
import com.club.triathlon.repo.UserRepository
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.http.HttpStatus
import org.springframework.security.core.Authentication
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken
import org.springframework.security.oauth2.core.user.OAuth2User
import org.springframework.security.web.authentication.SimpleUrlAuthenticationSuccessHandler
import org.springframework.stereotype.Component
import org.springframework.web.util.UriComponentsBuilder
import org.springframework.security.crypto.password.PasswordEncoder
import java.time.OffsetDateTime
import java.util.UUID

@Component
class OAuth2AuthenticationSuccessHandler(
    private val userRepository: UserRepository,
    private val jwtService: JwtService,
    private val passwordEncoder: PasswordEncoder,
    private val authCookieService: AuthCookieService,
    @Value("\${app.oauth.success-redirect:http://localhost:4200/auth/callback}") private val successRedirect: String,
    @Value("\${app.oauth.failure-redirect:http://localhost:4200/login?error=oauth_failed}") private val failureRedirect: String
) : SimpleUrlAuthenticationSuccessHandler() {

    private val logger = LoggerFactory.getLogger(OAuth2AuthenticationSuccessHandler::class.java)

    override fun onAuthenticationSuccess(
        request: HttpServletRequest,
        response: HttpServletResponse,
        authentication: Authentication
    ) {
        try {
            val oauthToken = authentication as? OAuth2AuthenticationToken
            if (oauthToken == null) {
                logger.error("Unexpected authentication type: ${authentication::class.java.simpleName}")
                redirectWithFailure(response, "invalid_authentication")
                return
            }

            val oAuth2User = oauthToken.principal as? OAuth2User
            if (oAuth2User == null) {
                logger.error("OAuth2 principal missing")
                redirectWithFailure(response, "missing_principal")
                return
            }

            val email = oAuth2User.getAttribute<String>("email")
            val providerId = oAuth2User.getAttribute<String>("sub")

            if (email.isNullOrBlank()) {
                logger.warn("OAuth2 user missing email. Attributes: ${oAuth2User.attributes.keys}")
                redirectWithFailure(response, "missing_email")
                return
            }

            if (providerId.isNullOrBlank()) {
                logger.warn("OAuth2 user missing provider id (sub)")
                redirectWithFailure(response, "missing_provider_id")
                return
            }

            val provider = oauthToken.authorizedClientRegistrationId.lowercase()
            val displayName = resolveDisplayName(oAuth2User, email)
            val avatarUrl = oAuth2User.getAttribute<String>("picture")

            val savedUser = synchronizeUser(provider, providerId, email, displayName, avatarUrl)

            logger.info("🔐 [OAuth2] Generated tokens for user: $email")
            val accessToken = jwtService.generateToken(savedUser)
            val refreshToken = jwtService.createRefreshToken(savedUser)

            logger.info("🍪 [OAuth2] Writing cookies for user: $email")
            authCookieService.writeAuthCookies(response, accessToken, refreshToken.token)

            clearAuthenticationAttributes(request)

            val redirectUri = UriComponentsBuilder
                .fromUriString(successRedirect)
                .queryParam("needsProfileCompletion", savedUser.requiresProfileCompletion())
                .build(true)
                .toUriString()

            logger.info("✅ [OAuth2] Login successful for email=$email, provider=$provider, redirecting to: $redirectUri")

            response.status = HttpStatus.FOUND.value()
            response.sendRedirect(redirectUri)
        } catch (ex: IllegalStateException) {
            logger.warn("OAuth2 login aborted: ${ex.message}")
            redirectWithFailure(response, ex.message ?: "oauth_error")
        } catch (ex: Exception) {
            logger.error("Failed to process OAuth2 authentication success", ex)
            redirectWithFailure(response, "internal_error")
        }
    }

    private fun synchronizeUser(
        provider: String,
        providerId: String,
        email: String,
        displayName: String,
        avatarUrl: String?
    ): User {
        val existing = userRepository.findByEmail(email).orElse(null)

        val user = if (existing == null) {
            logger.info("Creating new user from OAuth2 login: email=$email, provider=$provider")
            User().apply {
                this.email = email
                this.passwordHash = passwordEncoder.encode(UUID.randomUUID().toString())
                this.name = displayName
                this.phone = null
                this.role = Role.PARENT
                this.createdAt = OffsetDateTime.now()
                this.enabled = true
                this.markOAuthLogin(provider, providerId, avatarUrl)
            }
        } else {
            if (!existing.oauthProvider.isNullOrBlank() && existing.oauthProvider != provider) {
                logger.warn("User $email already linked to provider ${existing.oauthProvider} but attempted login with $provider")
                throw IllegalStateException("provider_mismatch")
            }

            if (!existing.oauthProviderId.isNullOrBlank() && existing.oauthProviderId != providerId) {
                logger.warn("Provider id mismatch for user $email. Expected ${existing.oauthProviderId}, received $providerId")
                throw IllegalStateException("provider_mismatch")
            }

            if (existing.name.isBlank()) {
                existing.name = displayName
            }
            existing.markOAuthLogin(provider, providerId, avatarUrl)
            existing
        }

        return userRepository.save(user)
    }

    private fun redirectWithFailure(response: HttpServletResponse, reason: String) {
        if (response.isCommitted) {
            logger.warn("Response already committed, cannot redirect to failure page")
            return
        }

        val uri = UriComponentsBuilder
            .fromUriString(failureRedirect)
            .queryParam("reason", reason)
            .build(true)
            .toUriString()
        response.status = HttpStatus.FOUND.value()
        response.sendRedirect(uri)
    }

    private fun resolveDisplayName(oAuth2User: OAuth2User, fallbackEmail: String): String {
        val name = oAuth2User.getAttribute<String>("name")
        if (!name.isNullOrBlank()) {
            return name
        }
        val given = oAuth2User.getAttribute<String>("given_name")
        val family = oAuth2User.getAttribute<String>("family_name")
        if (!given.isNullOrBlank() || !family.isNullOrBlank()) {
            return listOfNotNull(given, family).joinToString(" ").trim()
        }
        return fallbackEmail.substringBefore("@")
    }

    private fun <T> OAuth2User.getAttribute(name: String): T? = this.attributes[name] as? T
}

