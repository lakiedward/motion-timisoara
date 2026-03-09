package com.club.triathlon.web.coach

import com.club.triathlon.repo.ClubRepository
import com.club.triathlon.repo.CoachProfileRepository
import com.club.triathlon.repo.CourseRepository
import com.club.triathlon.security.UserPrincipal
import com.club.triathlon.service.AuditService
import com.club.triathlon.service.ClubInvitationCodeService
import com.club.triathlon.util.RequestUtils
import io.swagger.v3.oas.annotations.Operation
import io.swagger.v3.oas.annotations.security.SecurityRequirement
import io.swagger.v3.oas.annotations.tags.Tag
import jakarta.annotation.PostConstruct
import org.springframework.security.access.prepost.PreAuthorize
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.transaction.annotation.Transactional
import jakarta.validation.Valid
import jakarta.validation.constraints.NotBlank
import org.slf4j.LoggerFactory
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.server.ResponseStatusException
import java.util.UUID

@RestController
@RequestMapping("/api/coach/profile")
@PreAuthorize("hasRole('COACH')")
@Tag(name = "Coach - Profile", description = "Coach profile management")
class CoachProfileController(
    private val coachProfileRepository: CoachProfileRepository,
    private val clubRepository: ClubRepository,
    private val courseRepository: CourseRepository,
    private val clubInvitationCodeService: ClubInvitationCodeService,
    private val auditService: AuditService,
    @org.springframework.beans.factory.annotation.Value("\${app.security.trusted-proxies:}")
    private val trustedProxiesStr: String
) {
    private val logger = LoggerFactory.getLogger(CoachProfileController::class.java)

    private lateinit var trustedProxies: List<String>

    @PostConstruct
    fun init() {
        trustedProxies = trustedProxiesStr.split(",").map { it.trim() }.filter { it.isNotBlank() }
    }

    @GetMapping("/clubs")
    @Transactional(readOnly = true)
    @Operation(
        summary = "Get coach's clubs",
        description = "Get all clubs the coach belongs to",
        security = [SecurityRequirement(name = "bearerAuth")]
    )
    fun getMyClubs(
        @AuthenticationPrincipal principal: UserPrincipal
    ): List<CoachClubResponse> {
        val profile = coachProfileRepository.findByUser(principal.user)
            ?: return emptyList()
        
        return profile.clubs.map { club ->
            CoachClubResponse(
                id = club.id!!,
                name = club.name,
                canReceivePayments = club.canReceivePayments(),
                stripeConfigured = club.stripeAccountId != null && club.stripeOnboardingComplete
            )
        }
    }

    @PostMapping("/join-club")
    @Transactional
    @Operation(
        summary = "Join a club using invitation code",
        description = "Allows an existing coach to join a club using an invitation code",
        security = [SecurityRequirement(name = "bearerAuth")]
    )
    fun joinClub(
        @AuthenticationPrincipal principal: UserPrincipal,
        @Valid @RequestBody request: JoinClubRequest
    ): JoinClubResponse {
        val profile = coachProfileRepository.findByUser(principal.user)
            ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "Profilul de antrenor nu a fost găsit")

        // Check if already in this club
        val validation = clubInvitationCodeService.validateCode(request.code)
        if (!validation.valid) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, validation.message)
        }

        val alreadyInClub = profile.clubs.any { it.id == validation.clubId }
        if (alreadyInClub) {
            return JoinClubResponse(
                clubId = validation.clubId!!,
                clubName = validation.clubName!!,
                message = "Ești deja membru al clubului ${validation.clubName}"
            )
        }

        val club = clubInvitationCodeService.validateAndUseCode(request.code, profile)
        logger.info("✅ Coach ${principal.user.email} joined club ${club.name}")

        return JoinClubResponse(
            clubId = club.id!!,
            clubName = club.name,
            message = "Te-ai alăturat cu succes clubului ${club.name}"
        )
    }

    @PostMapping("/leave-club/{clubId}")
    @Transactional
    @Operation(
        summary = "Leave a club",
        description = "Allows an existing coach to leave a club",
        security = [SecurityRequirement(name = "bearerAuth")]
    )
    fun leaveClub(
        @AuthenticationPrincipal principal: UserPrincipal,
        @PathVariable clubId: UUID,
        servletRequest: jakarta.servlet.http.HttpServletRequest
    ): ResponseEntity<LeaveClubResponse> {
        val profile = coachProfileRepository.findByUser(principal.user)
            ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "Profilul de antrenor nu a fost găsit")

        // Validate membership without holding any DB lock
        if (profile.clubs.none { it.id == clubId }) {
            throw ResponseStatusException(HttpStatus.NOT_FOUND, "Nu ești membru al acestui club")
        }

        // Validate coach count without holding any DB lock
        val currentCoachCount = clubRepository.countCoachesByClubId(clubId)
        if (currentCoachCount <= 1) {
            throw ResponseStatusException(
                HttpStatus.CONFLICT,
                "Nu poți părăsi clubul deoarece ești ultimul antrenor. Te rugăm să transferi proprietatea sau să ștergi clubul."
            )
        }

        // Load club without lock for external validations
        val clubForValidation = clubRepository.findById(clubId).orElseThrow {
            ResponseStatusException(HttpStatus.NOT_FOUND, "Clubul nu există")
        }

        // Validate that coach doesn't have any courses (active or inactive) in this club
        if (courseRepository.existsByCoachAndClub(principal.user, clubForValidation)) {
            throw ResponseStatusException(
                HttpStatus.CONFLICT,
                "Nu poți părăsi clubul deoarece ai cursuri (active sau inactive) asociate. Te rugăm să le ștergi sau să soliciți reasignarea lor."
            )
        }

        // Acquire lock only for the mutation + save
        val club = clubRepository.findByIdWithLock(clubId)
            ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "Clubul nu există")

        // Quick re-checks under lock
        if (club.coaches.none { it.id == profile.id }) {
            throw ResponseStatusException(HttpStatus.NOT_FOUND, "Nu ești membru al acestui club")
        }
        val currentCoachCountLocked = clubRepository.countCoachesByClubId(clubId)
        if (currentCoachCountLocked <= 1) {
            throw ResponseStatusException(
                HttpStatus.CONFLICT,
                "Nu poți părăsi clubul deoarece ești ultimul antrenor. Te rugăm să transferi proprietatea sau să ștergi clubul."
            )
        }

        if (courseRepository.existsByCoachAndClub(principal.user, club)) {
            throw ResponseStatusException(
                HttpStatus.CONFLICT,
                "Nu poți părăsi clubul deoarece ai cursuri (active sau inactive) asociate. Te rugăm să le ștergi sau să soliciți reasignarea lor."
            )
        }

        // Remove association
        // Club is the owning side (@JoinTable is on Club), so we must remove from club.coaches to persist the change
        club.coaches.removeIf { it.id == profile.id }
        profile.clubs.removeIf { it.id == club.id }
        
        // Final safety check: ensure we're not leaving the club without coaches
        if (club.coaches.isEmpty()) {
            throw ResponseStatusException(
                HttpStatus.CONFLICT,
                "Operațiune eșuată: Clubul nu poate rămâne fără antrenori. Reîncercați operațiunea."
            )
        }
        
        // Save the club to persist the relationship change
        clubRepository.save(club)

        val ipAddress = RequestUtils.extractClientIp(servletRequest, trustedProxies)
        val actorId = principal.user.id
        val targetClubId = club.id
        
        if (actorId != null && targetClubId != null) {
            auditService.logChange(
                actorUserId = actorId,
                targetEntityId = targetClubId,
                targetEntityType = "CLUB",
                action = "LEAVE_CLUB",
                fieldName = "coaches",
                oldValue = profile.user.id?.toString(),
                newValue = null,
                ipAddress = ipAddress
            )
        } else {
             logger.warn("Skipping audit log for LEAVE_CLUB due to missing IDs. actorId=$actorId, clubId=$targetClubId")
        }
        
        logger.info("🚫 Coach ${principal.user.id} left club ${club.name}")

        return ResponseEntity.ok(
            LeaveClubResponse(
                clubId = club.id!!,
                clubName = club.name,
                message = "Ai părăsit clubul ${club.name}"
            )
        )
    }
}

data class CoachClubResponse(
    val id: UUID,
    val name: String,
    val canReceivePayments: Boolean,
    val stripeConfigured: Boolean
)

data class JoinClubRequest(
    @field:NotBlank(message = "Codul de invitație este obligatoriu")
    val code: String
)

data class JoinClubResponse(
    val clubId: UUID,
    val clubName: String,
    val message: String
)

data class LeaveClubResponse(
    val clubId: UUID,
    val clubName: String,
    val message: String
)
