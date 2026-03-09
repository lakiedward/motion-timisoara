package com.club.triathlon.service

import com.club.triathlon.domain.CoachInvitationCode
import com.club.triathlon.domain.User
import com.club.triathlon.repo.CoachInvitationCodeRepository
import org.slf4j.LoggerFactory
import org.springframework.http.HttpStatus
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.server.ResponseStatusException
import java.security.SecureRandom
import java.time.OffsetDateTime
import java.util.UUID

@Service
class InvitationCodeService(
    private val invitationCodeRepository: CoachInvitationCodeRepository
) {
    private val logger = LoggerFactory.getLogger(InvitationCodeService::class.java)
    private val secureRandom = SecureRandom()

    companion object {
        private const val CODE_PREFIX = "COACH"
        private const val CODE_LENGTH = 8
        private val CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789".toCharArray() // No I, O, 0, 1 for clarity
    }

    @Transactional
    fun createCode(admin: User, request: CreateInvitationCodeRequest): InvitationCodeDto {
        val code = generateUniqueCode()
        
        val expiresAt = request.expiresInDays?.let { days ->
            OffsetDateTime.now().plusDays(days.toLong())
        }
        
        val invitationCode = CoachInvitationCode().apply {
            this.code = code
            this.createdByAdmin = admin
            this.createdAt = OffsetDateTime.now()
            this.expiresAt = expiresAt
            this.maxUses = request.maxUses
            this.currentUses = 0
            this.notes = request.notes
        }
        
        val saved = invitationCodeRepository.save(invitationCode)
        logger.info("✅ Created invitation code: $code by admin: ${admin.email}")
        
        return saved.toDto()
    }

    @Transactional(readOnly = true)
    fun listCodes(): List<InvitationCodeDto> {
        return invitationCodeRepository.findAllOrderByCreatedAtDesc().map { it.toDto() }
    }

    @Transactional(readOnly = true)
    fun listValidCodes(): List<InvitationCodeDto> {
        return invitationCodeRepository.findAllValid().map { it.toDto() }
    }

    @Transactional(readOnly = true)
    fun getCodeById(id: UUID): InvitationCodeDto {
        val code = invitationCodeRepository.findById(id).orElseThrow {
            ResponseStatusException(HttpStatus.NOT_FOUND, "Invitation code not found")
        }
        return code.toDto()
    }

    @Transactional
    fun revokeCode(id: UUID) {
        val code = invitationCodeRepository.findById(id).orElseThrow {
            ResponseStatusException(HttpStatus.NOT_FOUND, "Invitation code not found")
        }
        
        // Set maxUses to currentUses to effectively disable the code
        code.maxUses = code.currentUses
        code.expiresAt = OffsetDateTime.now()
        invitationCodeRepository.save(code)
        
        logger.info("🚫 Revoked invitation code: ${code.code}")
    }

    @Transactional
    fun deleteCode(id: UUID) {
        val code = invitationCodeRepository.findById(id).orElseThrow {
            ResponseStatusException(HttpStatus.NOT_FOUND, "Invitation code not found")
        }
        
        if (code.currentUses > 0) {
            throw ResponseStatusException(
                HttpStatus.CONFLICT, 
                "Cannot delete a code that has been used. Use revoke instead."
            )
        }
        
        invitationCodeRepository.delete(code)
        logger.info("🗑️ Deleted invitation code: ${code.code}")
    }

    /**
     * Validate code without using it (for pre-validation)
     */
    fun validateCode(code: String) {
        val invitationCode = invitationCodeRepository.findByCode(code)
            ?: throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Cod de invitație invalid")
        
        if (!invitationCode.isValid()) {
            if (invitationCode.isExpired()) {
                throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Codul de invitație a expirat")
            }
            if (invitationCode.isFullyUsed()) {
                throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Codul de invitație a fost deja folosit")
            }
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Cod de invitație invalid")
        }
    }

    @Transactional
    fun validateAndUseCode(code: String, user: User): CoachInvitationCode {
        val invitationCode = invitationCodeRepository.findByCode(code)
            ?: throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Cod de invitație invalid")
        
        if (!invitationCode.isValid()) {
            if (invitationCode.isExpired()) {
                throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Codul de invitație a expirat")
            }
            if (invitationCode.isFullyUsed()) {
                throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Codul de invitație a fost deja folosit")
            }
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Cod de invitație invalid")
        }
        
        // Mark as used
        invitationCode.currentUses++
        if (invitationCode.maxUses == 1) {
            invitationCode.usedByUser = user
            invitationCode.usedAt = OffsetDateTime.now()
        }
        
        val saved = invitationCodeRepository.save(invitationCode)
        logger.info("✅ Invitation code used: $code by user: ${user.email}")
        
        return saved
    }

    private fun generateUniqueCode(): String {
        var attempts = 0
        while (attempts < 10) {
            val randomPart = (1..CODE_LENGTH)
                .map { CODE_CHARS[secureRandom.nextInt(CODE_CHARS.size)] }
                .joinToString("")
            
            val code = "$CODE_PREFIX-$randomPart"
            
            if (!invitationCodeRepository.existsByCode(code)) {
                return code
            }
            attempts++
        }
        throw ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Could not generate unique code")
    }

    private fun CoachInvitationCode.toDto(): InvitationCodeDto {
        return InvitationCodeDto(
            id = this.id!!,
            code = this.code,
            maxUses = this.maxUses,
            currentUses = this.currentUses,
            expiresAt = this.expiresAt,
            createdAt = this.createdAt,
            notes = this.notes,
            usedByEmail = this.usedByUser?.email,
            isValid = this.isValid(),
            isExpired = this.isExpired(),
            createdByAdminEmail = this.createdByAdmin.email
        )
    }
}

data class CreateInvitationCodeRequest(
    val maxUses: Int = 1,
    val expiresInDays: Int? = 30,
    val notes: String? = null
)

data class InvitationCodeDto(
    val id: UUID,
    val code: String,
    val maxUses: Int,
    val currentUses: Int,
    val expiresAt: OffsetDateTime?,
    val createdAt: OffsetDateTime,
    val notes: String?,
    val usedByEmail: String?,
    val isValid: Boolean,
    val isExpired: Boolean,
    val createdByAdminEmail: String
)
