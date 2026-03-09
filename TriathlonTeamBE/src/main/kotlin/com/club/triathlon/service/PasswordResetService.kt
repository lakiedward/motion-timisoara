package com.club.triathlon.service

import com.club.triathlon.domain.PasswordResetToken
import com.club.triathlon.repo.PasswordResetTokenRepository
import com.club.triathlon.repo.UserRepository
import com.club.triathlon.security.JwtService
import com.club.triathlon.service.mail.MailService
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.security.crypto.password.PasswordEncoder
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.security.SecureRandom
import java.time.OffsetDateTime
import java.time.temporal.ChronoUnit
import java.util.Base64

@Service
class PasswordResetService(
    private val userRepository: UserRepository,
    private val passwordResetTokenRepository: PasswordResetTokenRepository,
    private val mailService: MailService,
    private val passwordEncoder: PasswordEncoder,
    private val jwtService: JwtService,
    @Value("\${app.password-reset.expiration-minutes:60}") private val expirationMinutes: Long,
    @Value("\${app.frontend.base-url:http://localhost:4200}") private val frontendBaseUrl: String
) {

    private val logger = LoggerFactory.getLogger(PasswordResetService::class.java)

    companion object {
        private const val TOKEN_LENGTH_BYTES = 32
        private val secureRandom = SecureRandom()
    }

    @Transactional
    fun requestReset(email: String) {
        val normalizedEmail = email.trim()
        val userOpt = userRepository.findByEmail(normalizedEmail)
        if (userOpt.isEmpty) {
            logger.warn("Password reset requested for non-existing email: {}", normalizedEmail)
            return
        }

        val user = userOpt.get()
        val tokenString = generateToken()
        val now = OffsetDateTime.now()

        val token = PasswordResetToken().apply {
            token = tokenString
            this.user = user
            createdAt = now
            expiresAt = now.plus(expirationMinutes, ChronoUnit.MINUTES)
        }

        passwordResetTokenRepository.save(token)

        val base = frontendBaseUrl.trimEnd('/')
        val resetUrl = "$base/reset-password?token=$tokenString"

        mailService.sendPasswordResetEmail(user.email, resetUrl, expirationMinutes)
        logger.info("Password reset token created for user {}", user.email)
    }

    @Transactional
    fun resetPassword(tokenString: String, newPassword: String) {
        val token = passwordResetTokenRepository.findByToken(tokenString).orElse(null)
            ?: throw IllegalArgumentException("Token invalid sau expirat")

        if (!token.isValid()) {
            logger.warn("Attempt to use invalid password reset token: {}", tokenString)
            throw IllegalArgumentException("Token invalid sau expirat")
        }

        val user = token.user
        user.passwordHash = passwordEncoder.encode(newPassword)
        token.markAsUsed()

        userRepository.save(user)
        passwordResetTokenRepository.save(token)
        jwtService.revokeAllUserTokens(user)

        logger.info("Password reset successfully for user {}", user.email)
    }

    private fun generateToken(): String {
        val bytes = ByteArray(TOKEN_LENGTH_BYTES)
        secureRandom.nextBytes(bytes)
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes)
    }
}
