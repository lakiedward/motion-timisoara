package com.club.triathlon.service

import com.club.triathlon.domain.Club
import com.club.triathlon.domain.ClubInvitationCode
import com.club.triathlon.domain.CoachProfile
import com.club.triathlon.repo.ClubInvitationCodeRepository
import com.club.triathlon.repo.ClubRepository
import org.slf4j.LoggerFactory
import org.springframework.http.HttpStatus
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.server.ResponseStatusException
import java.security.SecureRandom
import java.time.OffsetDateTime
import java.util.UUID

@Service
class ClubInvitationCodeService(
    private val clubInvitationCodeRepository: ClubInvitationCodeRepository,
    private val clubRepository: ClubRepository
) {
    private val logger = LoggerFactory.getLogger(ClubInvitationCodeService::class.java)
    private val secureRandom = SecureRandom()

    /**
     * Generate a new invitation code for a club
     */
    @Transactional
    fun generateCode(
        clubId: UUID,
        maxUses: Int = 1,
        expiresInDays: Int? = 30,
        notes: String? = null,
        coachNameHint: String? = null
    ): ClubInvitationCode {
        val club = clubRepository.findById(clubId).orElseThrow {
            ResponseStatusException(HttpStatus.NOT_FOUND, "Club not found")
        }

        val code = generateUniqueCode()
        
        val invitationCode = ClubInvitationCode().apply {
            this.code = code
            this.club = club
            this.maxUses = maxUses
            this.currentUses = 0
            this.createdAt = OffsetDateTime.now()
            this.expiresAt = expiresInDays?.let { OffsetDateTime.now().plusDays(it.toLong()) }
            this.notes = notes
            this.coachNameHint = coachNameHint
        }

        val saved = clubInvitationCodeRepository.save(invitationCode)
        logger.info("✅ Generated invitation code for club ${club.name}: $code")
        return saved
    }

    /**
     * Validate an invitation code without using it
     */
    fun validateCode(code: String): ClubInvitationCodeValidation {
        val invitationCode = clubInvitationCodeRepository.findByCode(code)
            ?: return ClubInvitationCodeValidation(
                valid = false,
                message = "Cod de invitație invalid",
                clubName = null,
                clubId = null
            )

        if (!invitationCode.isValid()) {
            val message = when {
                invitationCode.isExpired() -> "Codul de invitație a expirat"
                invitationCode.isFullyUsed() -> "Codul de invitație a fost deja folosit"
                else -> "Cod de invitație invalid"
            }
            return ClubInvitationCodeValidation(
                valid = false,
                message = message,
                clubName = null,
                clubId = null
            )
        }

        return ClubInvitationCodeValidation(
            valid = true,
            message = "Cod valid pentru ${invitationCode.club.name}",
            clubName = invitationCode.club.name,
            clubId = invitationCode.club.id
        )
    }

    /**
     * Validate and use an invitation code when a coach registers
     * Returns the club the coach should be associated with
     */
    @Transactional
    fun validateAndUseCode(code: String, coachProfile: CoachProfile): Club {
        val invitationCode = clubInvitationCodeRepository.findByCode(code)
            ?: throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Cod de invitație invalid")

        if (!invitationCode.isValid()) {
            val message = when {
                invitationCode.isExpired() -> "Codul de invitație a expirat"
                invitationCode.isFullyUsed() -> "Codul de invitație a fost deja folosit"
                else -> "Cod de invitație invalid"
            }
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, message)
        }

        // Mark code as used
        invitationCode.markUsed(coachProfile)
        clubInvitationCodeRepository.save(invitationCode)

        // Associate coach with club
        val club = invitationCode.club
        club.coaches.add(coachProfile)
        clubRepository.save(club)

        logger.info("✅ Coach ${coachProfile.user.email} joined club ${club.name} using code $code")
        return club
    }

    /**
     * Get all invitation codes for a club
     */
    fun getClubCodes(clubId: UUID): List<ClubInvitationCodeDto> {
        val club = clubRepository.findById(clubId).orElseThrow {
            ResponseStatusException(HttpStatus.NOT_FOUND, "Club not found")
        }

        return clubInvitationCodeRepository.findByClubOrderByCreatedAtDesc(club)
            .map { it.toDto() }
    }

    /**
     * Delete an invitation code
     */
    @Transactional
    fun deleteCode(codeId: UUID, clubId: UUID) {
        val code = clubInvitationCodeRepository.findById(codeId).orElseThrow {
            ResponseStatusException(HttpStatus.NOT_FOUND, "Code not found")
        }

        if (code.club.id != clubId) {
            throw ResponseStatusException(HttpStatus.FORBIDDEN, "Code does not belong to this club")
        }

        clubInvitationCodeRepository.delete(code)
        logger.info("🗑️ Deleted invitation code ${code.code} for club $clubId")
    }

    private fun generateUniqueCode(): String {
        val chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789" // Excludes confusing chars like 0/O, 1/I/L
        var code: String
        do {
            code = (1..8)
                .map { chars[secureRandom.nextInt(chars.length)] }
                .joinToString("")
                .chunked(4)
                .joinToString("-") // Format: XXXX-XXXX
        } while (clubInvitationCodeRepository.existsByCode(code))
        return code
    }

    private fun ClubInvitationCode.toDto() = ClubInvitationCodeDto(
        id = this.id!!,
        code = this.code,
        clubId = this.club.id!!,
        clubName = this.club.name,
        maxUses = this.maxUses,
        currentUses = this.currentUses,
        createdAt = this.createdAt,
        expiresAt = this.expiresAt,
        notes = this.notes,
        coachNameHint = this.coachNameHint,
        isValid = this.isValid(),
        usedByCoachName = this.usedByCoach?.user?.name
    )
}

data class ClubInvitationCodeValidation(
    val valid: Boolean,
    val message: String,
    val clubName: String?,
    val clubId: UUID?
)

data class ClubInvitationCodeDto(
    val id: UUID,
    val code: String,
    val clubId: UUID,
    val clubName: String,
    val maxUses: Int,
    val currentUses: Int,
    val createdAt: OffsetDateTime,
    val expiresAt: OffsetDateTime?,
    val notes: String?,
    val coachNameHint: String?,
    @get:com.fasterxml.jackson.annotation.JsonProperty("isValid")
    val isValid: Boolean,
    val usedByCoachName: String?
)
