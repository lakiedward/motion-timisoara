package com.club.triathlon.web.club

import com.club.triathlon.domain.AnnouncementPriority
import com.club.triathlon.domain.Club
import com.club.triathlon.domain.ClubAnnouncement
import com.club.triathlon.domain.CoachProfile
import com.club.triathlon.domain.Course
import com.club.triathlon.domain.Location
import com.club.triathlon.domain.User
import com.club.triathlon.enums.LocationType
import com.club.triathlon.enums.Role
import com.club.triathlon.repo.ClubAnnouncementRepository
import com.club.triathlon.repo.ClubRepository
import com.club.triathlon.repo.CoachProfileRepository
import com.club.triathlon.repo.CourseRepository
import com.club.triathlon.repo.LocationRepository
import com.club.triathlon.repo.SportRepository
import com.club.triathlon.repo.UserRepository
import java.time.OffsetDateTime
import com.club.triathlon.security.UserPrincipal
import com.club.triathlon.service.ClubInvitationCodeDto
import com.club.triathlon.service.ClubInvitationCodeService
import com.club.triathlon.service.LocationService
import com.club.triathlon.service.StripeAccountStatus
import com.club.triathlon.service.StripeConnectService
import com.club.triathlon.service.AdminCourseService
import com.club.triathlon.service.course.CourseRequest
import com.club.triathlon.service.course.CourseResponse
import com.club.triathlon.service.course.CourseService
import jakarta.validation.Valid
import jakarta.validation.constraints.Email
import jakarta.validation.constraints.Max
import jakarta.validation.constraints.Min
import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.Size
import org.slf4j.LoggerFactory
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.security.access.prepost.PreAuthorize
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.security.crypto.password.PasswordEncoder
import org.springframework.web.bind.annotation.*
import org.springframework.web.server.ResponseStatusException
import org.springframework.transaction.annotation.Transactional
import java.util.UUID
import com.club.triathlon.util.PhotoUtils
import com.club.triathlon.util.RequestUtils

import com.club.triathlon.service.AuditService

@RestController
@RequestMapping("/api/club")
@PreAuthorize("hasRole('CLUB')")
class ClubDashboardController(
    private val clubRepository: ClubRepository,
    private val coachProfileRepository: CoachProfileRepository,
    private val clubInvitationCodeService: ClubInvitationCodeService,
    private val stripeConnectService: StripeConnectService,
    private val locationRepository: LocationRepository,
    private val locationService: LocationService,
    private val courseRepository: CourseRepository,
    private val courseService: CourseService,
    private val adminCourseService: AdminCourseService,
    private val sportRepository: SportRepository,
    private val userRepository: UserRepository,
    private val clubAnnouncementRepository: ClubAnnouncementRepository,
    private val passwordEncoder: PasswordEncoder,
    private val auditService: AuditService,
    @org.springframework.beans.factory.annotation.Value("\${app.security.trusted-proxies:}")
    private val trustedProxiesStr: String
) {
    private val logger = LoggerFactory.getLogger(ClubDashboardController::class.java)

    private val trustedProxies: List<String> by lazy {
        trustedProxiesStr.split(",").map { it.trim() }.filter { it.isNotBlank() }
    }

    // ============================================
    // Club Profile
    // ============================================

    @GetMapping("/profile")
    @Transactional(readOnly = true)
    fun getClubProfile(@AuthenticationPrincipal principal: UserPrincipal): ClubProfileResponse {
        val club = getClubForUser(principal)
        return club.toProfileResponse()
    }

    @PostMapping("/profile/logo")
    @Transactional
    fun uploadClubLogo(
        @AuthenticationPrincipal principal: UserPrincipal,
        @Valid @RequestBody request: UploadClubLogoRequest
    ): ClubProfileResponse {
        val club = getClubForUser(principal)

        val (bytes, contentType) = PhotoUtils.processPhoto(request.logo)
        club.logo = bytes
        club.logoContentType = contentType
        // Prefer blob over external URL, if any
        club.logoUrl = null

        val saved = clubRepository.save(club)
        return saved.toProfileResponse()
    }

    @DeleteMapping("/profile/logo")
    @Transactional
    fun deleteClubLogo(@AuthenticationPrincipal principal: UserPrincipal): ClubProfileResponse {
        val club = getClubForUser(principal)

        club.logo = null
        club.logoContentType = null
        club.logoUrl = null

        val saved = clubRepository.save(club)
        return saved.toProfileResponse()
    }

    @PostMapping("/profile/hero-photo")
    @Transactional
    fun uploadClubHeroPhoto(
        @AuthenticationPrincipal principal: UserPrincipal,
        @Valid @RequestBody request: UploadClubHeroPhotoRequest
    ): ClubProfileResponse {
        val club = getClubForUser(principal)

        val (bytes, contentType) = PhotoUtils.processPhoto(request.photo)
        club.heroPhoto = bytes
        club.heroPhotoContentType = contentType

        val saved = clubRepository.save(club)
        return saved.toProfileResponse()
    }

    @DeleteMapping("/profile/hero-photo")
    @Transactional
    fun deleteClubHeroPhoto(@AuthenticationPrincipal principal: UserPrincipal): ClubProfileResponse {
        val club = getClubForUser(principal)

        club.heroPhoto = null
        club.heroPhotoContentType = null

        val saved = clubRepository.save(club)
        return saved.toProfileResponse()
    }

    private fun extractClientIp(request: jakarta.servlet.http.HttpServletRequest): String {
        return RequestUtils.extractClientIp(request, trustedProxies)
    }

    @PatchMapping("/profile")
    @Transactional
    fun updateClubProfile(
        @AuthenticationPrincipal principal: UserPrincipal,
        @Valid @RequestBody request: UpdateClubProfileRequest,
        servletRequest: jakarta.servlet.http.HttpServletRequest
    ): ClubProfileResponse {
        val club = getClubForUser(principal)
        
        request.name?.let { 
            val trimmed = it.trim()
            if (trimmed.isBlank()) {
                throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Name cannot be empty")
            }
            club.name = trimmed 
        }
        request.description?.let { club.description = it.trim() }
        request.phone?.let { club.phone = it.trim() }
        request.email?.let { 
            val trimmed = it.trim()
            if (trimmed.isBlank()) {
                throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Email cannot be empty")
            }
            club.email = trimmed 
        }
        request.address?.let { club.address = it.trim() }
        request.city?.let { club.city = it.trim() }
        request.website?.let { club.website = it.trim() }
        request.publicEmailConsent?.let { newConsent ->
            if (club.publicEmailConsent != newConsent) {
                val ipAddress = extractClientIp(servletRequest)
                auditService.logConsentChange(
                    clubId = club.id!!,
                    actorUserId = principal.user.id!!,
                    oldValue = club.publicEmailConsent,
                    newValue = newConsent,
                    ipAddress = ipAddress
                )
                club.publicEmailConsent = newConsent
            }
        }

        // Company / Billing Info (for invoicing)
        request.companyName?.let { club.companyName = it.trim() }
        request.companyCui?.let { club.companyCui = it.trim() }
        request.companyRegNumber?.let { club.companyRegNumber = it.trim() }
        request.companyAddress?.let { club.companyAddress = it.trim() }
        request.bankAccount?.let { club.bankAccount = it.trim() }
        request.bankName?.let { club.bankName = it.trim() }
        
        val saved = clubRepository.save(club)
        logger.info(" Club profile updated: ${club.name}")
        return saved.toProfileResponse()
    }

    @PostMapping("/profile/consent/withdraw")
    @Transactional
    fun withdrawEmailConsent(
        @AuthenticationPrincipal principal: UserPrincipal,
        request: jakarta.servlet.http.HttpServletRequest
    ): ResponseEntity<Map<String, String>> {
        val club = getClubForUser(principal)
        
        if (!club.publicEmailConsent) {
            return ResponseEntity.ok(mapOf("message" to "consent.email.already_withdrawn"))
        }

        val ipAddress = extractClientIp(request)
        auditService.logConsentChange(
            clubId = club.id!!,
            actorUserId = principal.user.id!!,
            oldValue = true,
            newValue = false,
            ipAddress = ipAddress
        )
        club.publicEmailConsent = false
        clubRepository.save(club)
        logger.info("Public email consent withdrawn for club ${club.name}")
        
        return ResponseEntity.ok(mapOf("message" to "consent.email.withdrawn"))
    }

    // ============================================
    // Dashboard Stats
    // ============================================

    @GetMapping("/stats")
    @Transactional(readOnly = true)
    fun getDashboardStats(@AuthenticationPrincipal principal: UserPrincipal): ClubDashboardStats {
        val club = getClubForUser(principal)
        val coachCount = club.coaches.size
        val activeInvitationCodes = clubInvitationCodeService.getClubCodes(club.id!!)
            .count { it.isValid }
        
        return ClubDashboardStats(
            coachCount = coachCount,
            activeInvitationCodes = activeInvitationCodes,
            stripeOnboardingComplete = club.stripeOnboardingComplete,
            canReceivePayments = club.canReceivePayments()
        )
    }

    // ============================================
    // Coaches Management
    // ============================================

    @GetMapping("/coaches")
    @Transactional(readOnly = true)
    fun listCoaches(@AuthenticationPrincipal principal: UserPrincipal): List<ClubCoachResponse> {
        val club = getClubForUser(principal)
        return club.coaches.map { coach ->
            ClubCoachResponse(
                id = coach.id!!,
                userId = coach.user.id!!,
                name = coach.user.name,
                email = coach.user.email,
                phone = coach.user.phone,
                sports = coach.sports.map { it.name },
                stripeOnboardingComplete = coach.stripeOnboardingComplete,
                canReceivePayments = coach.canReceivePayments(),
                avatarUrl = coach.avatarUrl,
                hasPhoto = coach.photo != null
            )
        }
    }

    @GetMapping("/coaches/{coachId}")
    @Transactional(readOnly = true)
    fun getCoach(
        @AuthenticationPrincipal principal: UserPrincipal,
        @PathVariable coachId: UUID
    ): ClubCoachDetailResponse {
        val club = getClubForUser(principal)
        val coach = club.coaches.find { it.id == coachId }
            ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "Coach not found in this club")

        return ClubCoachDetailResponse(
            id = coach.id!!,
            userId = coach.user.id!!,
            name = coach.user.name,
            email = coach.user.email,
            phone = coach.user.phone,
            bio = coach.bio,
            sportIds = coach.sports.map { it.id!! },
            sports = coach.sports.map { it.name },
            stripeOnboardingComplete = coach.stripeOnboardingComplete,
            canReceivePayments = coach.canReceivePayments(),
            avatarUrl = coach.avatarUrl,
            hasPhoto = coach.photo != null
        )
    }

    @PutMapping("/coaches/{coachId}")
    @Transactional
    fun updateCoach(
        @AuthenticationPrincipal principal: UserPrincipal,
        @PathVariable coachId: UUID,
        @Valid @RequestBody request: UpdateClubCoachRequest
    ): ClubCoachDetailResponse {
        val club = getClubForUser(principal)
        val coach = club.coaches.find { it.id == coachId }
            ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "Coach not found in this club")

        val user = coach.user

        val newName = request.name.trim()
        val newEmail = request.email.trim()

        if (!newEmail.equals(user.email, ignoreCase = true)) {
            val existing = userRepository.findByEmail(newEmail)
            if (existing.isPresent && existing.get().id != user.id) {
                throw ResponseStatusException(HttpStatus.CONFLICT, "Email deja înregistrat")
            }
            user.email = newEmail
        }

        user.name = newName
        user.phone = request.phone?.trim()?.takeIf { it.isNotBlank() }

        request.password?.let { raw ->
            val trimmed = raw.trim()
            if (trimmed.isNotEmpty()) {
                if (trimmed.length < 8) {
                    throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Parola trebuie să aibă minim 8 caractere")
                }
                user.passwordHash = passwordEncoder.encode(trimmed)
            }
        }

        userRepository.save(user)

        coach.bio = request.bio?.trim()?.takeIf { it.isNotBlank() }

        // Update sports (PUT semantics: if list provided, replace; if null, clear)
        coach.sports.clear()
        val sportIds = request.sportIds ?: emptyList()
        if (sportIds.isNotEmpty()) {
            val sports = sportRepository.findAllById(sportIds)
            coach.sports.addAll(sports)
        }

        request.photo?.let { base64Photo ->
            if (base64Photo.isNotBlank()) {
                val photoData = PhotoUtils.processPhoto(base64Photo)
                coach.photo = photoData.first
                coach.photoContentType = photoData.second
            }
        }

        coachProfileRepository.save(coach)

        return ClubCoachDetailResponse(
            id = coach.id!!,
            userId = user.id!!,
            name = user.name,
            email = user.email,
            phone = user.phone,
            bio = coach.bio,
            sportIds = coach.sports.map { it.id!! },
            sports = coach.sports.map { it.name },
            stripeOnboardingComplete = coach.stripeOnboardingComplete,
            canReceivePayments = coach.canReceivePayments(),
            avatarUrl = coach.avatarUrl,
            hasPhoto = coach.photo != null
        )
    }

    @PostMapping("/coaches")
    @Transactional
    fun createCoach(
        @AuthenticationPrincipal principal: UserPrincipal,
        @Valid @RequestBody request: CreateClubCoachRequest
    ): ClubCoachResponse {
        val club = getClubForUser(principal)

        if (userRepository.existsByEmail(request.email.trim())) {
            throw ResponseStatusException(
                HttpStatus.CONFLICT,
                "Email deja înregistrat. Folosește invitația (cod) pentru a atașa un antrenor existent."
            )
        }

        val user = User().apply {
            email = request.email.trim()
            passwordHash = passwordEncoder.encode(request.password)
            name = request.name.trim()
            phone = request.phone?.trim()
            role = Role.COACH
            createdAt = OffsetDateTime.now()
            enabled = true
        }
        val savedUser = userRepository.save(user)

        val sports = if (request.sportIds.isNullOrEmpty()) {
            mutableSetOf()
        } else {
            sportRepository.findAllById(request.sportIds).toMutableSet()
        }

        val coachProfile = CoachProfile().apply {
            this.user = savedUser
            bio = request.bio?.trim()
            this.sports = sports

            // Process photo if provided
            request.photo?.let { base64Photo ->
                val photoData = PhotoUtils.processPhoto(base64Photo)
                this.photo = photoData.first
                this.photoContentType = photoData.second
            }
        }
        val savedCoachProfile = coachProfileRepository.save(coachProfile)

        club.coaches.add(savedCoachProfile)
        clubRepository.save(club)

        try {
            if (stripeConnectService.isStripeConfigured()) {
                stripeConnectService.createExpressAccount(savedUser.id!!, savedUser.email)
            }
        } catch (e: Exception) {
            logger.error("❌ Failed to create Stripe account for coach \${savedUser.id}: \${e.message}", e)
        }

        logger.info("✅ Created coach \${savedUser.email} for club \${club.name}")

        return ClubCoachResponse(
            id = savedCoachProfile.id!!,
            userId = savedUser.id!!,
            name = savedUser.name,
            email = savedUser.email,
            phone = savedUser.phone,
            sports = savedCoachProfile.sports.map { it.name },
            stripeOnboardingComplete = savedCoachProfile.stripeOnboardingComplete,
            canReceivePayments = savedCoachProfile.canReceivePayments(),
            avatarUrl = savedCoachProfile.avatarUrl,
            hasPhoto = savedCoachProfile.photo != null
        )
    }

    @DeleteMapping("/coaches/{coachId}")
    fun removeCoach(
        @AuthenticationPrincipal principal: UserPrincipal,
        @PathVariable coachId: UUID
    ): ResponseEntity<Map<String, String>> {
        val club = getClubForUser(principal)
        val coach = club.coaches.find { it.id == coachId }
            ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "Coach not found in this club")
        
        club.coaches.remove(coach)
        clubRepository.save(club)
        
        logger.info(" Removed coach ${coach.user.email} from club ${club.name}")
        return ResponseEntity.ok(mapOf("message" to "Coach removed from club"))
    }

    // ============================================
    // Invitation Codes
    // ============================================

    @GetMapping("/invitation-codes")
    @Transactional(readOnly = true)
    fun listInvitationCodes(@AuthenticationPrincipal principal: UserPrincipal): List<ClubInvitationCodeDto> {
        val club = getClubForUser(principal)
        return clubInvitationCodeService.getClubCodes(club.id!!)
    }

    @PostMapping("/invitation-codes")
    fun createInvitationCode(
        @AuthenticationPrincipal principal: UserPrincipal,
        @Valid @RequestBody request: CreateInvitationCodeRequest
    ): ClubInvitationCodeDto {
        val club = getClubForUser(principal)
        return clubInvitationCodeService.generateCode(
            clubId = club.id!!,
            maxUses = request.maxUses,
            expiresInDays = request.expiresInDays,
            notes = request.notes,
            coachNameHint = request.coachNameHint
        ).let { code ->
            ClubInvitationCodeDto(
                id = code.id!!,
                code = code.code,
                clubId = club.id!!,
                clubName = club.name,
                maxUses = code.maxUses,
                currentUses = code.currentUses,
                createdAt = code.createdAt,
                expiresAt = code.expiresAt,
                notes = code.notes,
                coachNameHint = code.coachNameHint,
                isValid = code.isValid(),
                usedByCoachName = code.usedByCoach?.user?.name
            )
        }
    }

    @DeleteMapping("/invitation-codes/{codeId}")
    fun deleteInvitationCode(
        @AuthenticationPrincipal principal: UserPrincipal,
        @PathVariable codeId: UUID
    ): ResponseEntity<Map<String, String>> {
        val club = getClubForUser(principal)
        clubInvitationCodeService.deleteCode(codeId, club.id!!)
        return ResponseEntity.ok(mapOf("message" to "Invitation code deleted"))
    }

    // ============================================
    // Stripe Connect
    // ============================================

    @GetMapping("/stripe/status")
    fun getStripeStatus(@AuthenticationPrincipal principal: UserPrincipal): StripeAccountStatus {
        val club = getClubForUser(principal)
        return stripeConnectService.refreshClubAccountStatus(club.id!!)
    }

    @GetMapping("/stripe/onboarding-link")
    fun getStripeOnboardingLink(@AuthenticationPrincipal principal: UserPrincipal): Map<String, String> {
        val club = getClubForUser(principal)
        val url = stripeConnectService.generateClubOnboardingLink(club.id!!)
        return mapOf("url" to url)
    }

    @GetMapping("/stripe/dashboard-link")
    fun getStripeDashboardLink(@AuthenticationPrincipal principal: UserPrincipal): Map<String, String> {
        val club = getClubForUser(principal)
        val url = stripeConnectService.generateClubDashboardLink(club.id!!)
        return mapOf("url" to url)
    }

    // ============================================
    // Locations Management
    // ============================================

    @GetMapping("/locations")
    @Transactional(readOnly = true)
    fun listLocations(@AuthenticationPrincipal principal: UserPrincipal): List<ClubLocationResponse> {
        val club = getClubForUser(principal)
        return locationRepository.findByClubId(club.id!!).map { it.toClubResponse() }
    }

    @PostMapping("/locations")
    @Transactional
    fun createLocation(
        @AuthenticationPrincipal principal: UserPrincipal,
        @Valid @RequestBody request: CreateClubLocationRequest
    ): ClubLocationResponse {
        val club = getClubForUser(principal)
        
        val locationType = request.type?.let { 
            try { LocationType.valueOf(it) } catch (e: Exception) { LocationType.OTHER }
        } ?: LocationType.OTHER

        val saved = locationService.createLocation(
            name = request.name.trim(),
            city = request.city?.trim(),
            address = request.address?.trim(),
            type = locationType,
            lat = request.lat,
            lng = request.lng,
            description = request.description?.trim(),
            capacity = request.capacity,
            createdBy = principal.user,
            club = club
        )

        logger.info(" Location created: ${saved.name} for club ${club.name}")
        return saved.toClubResponse()
    }

    @PutMapping("/locations/{locationId}")
    @Transactional
    fun updateLocation(
        @AuthenticationPrincipal principal: UserPrincipal,
        @PathVariable locationId: UUID,
        @Valid @RequestBody request: UpdateClubLocationRequest
    ): ClubLocationResponse {
        val club = getClubForUser(principal)
        val location = locationRepository.findByClubIdAndId(club.id!!, locationId)
            ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "Location not found")
        
        request.name?.let { 
            val trimmed = it.trim()
            if (trimmed.isBlank()) {
                throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Name cannot be empty")
            }
            location.name = trimmed 
        }
        request.address?.let { location.address = it.trim() }
        request.city?.let { location.city = it.trim() }
        request.description?.let { location.description = it.trim() }
        request.capacity?.let { location.capacity = it }
        request.isActive?.let { location.isActive = it }
        request.lat?.let { location.lat = it }
        request.lng?.let { location.lng = it }
        request.type?.let { 
            try { location.type = LocationType.valueOf(it) } catch (e: Exception) { /* ignore */ }
        }
        
        val saved = locationRepository.save(location)
        logger.info("✅ Location updated: ${saved.name}")
        return saved.toClubResponse()
    }

    @DeleteMapping("/locations/{locationId}")
    @Transactional
    fun deleteLocation(
        @AuthenticationPrincipal principal: UserPrincipal,
        @PathVariable locationId: UUID
    ): ResponseEntity<Map<String, String>> {
        val club = getClubForUser(principal)
        val location = locationRepository.findByClubIdAndId(club.id!!, locationId)
            ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "Location not found")
        
        locationRepository.delete(location)
        logger.info("🗑️ Location deleted: ${location.name}")
        return ResponseEntity.ok(mapOf("message" to "Location deleted"))
    }

    private fun Location.toClubResponse() = ClubLocationResponse(
        id = this.id!!,
        name = this.name,
        address = this.address,
        city = this.city,
        description = this.description,
        capacity = this.capacity,
        isActive = this.isActive,
        lat = this.lat,
        lng = this.lng,
        type = this.type.name
    )

    // ============================================
    // Courses Management
    // ============================================

    @GetMapping("/courses")
    @Transactional(readOnly = true)
    fun listCourses(@AuthenticationPrincipal principal: UserPrincipal): List<ClubCourseResponse> {
        val club = getClubForUser(principal)
        return courseRepository.findByClubId(club.id!!).map { it.toClubResponse() }
    }

    @GetMapping("/courses/stats")
    @Transactional(readOnly = true)
    fun getCourseStats(@AuthenticationPrincipal principal: UserPrincipal): ClubCourseStats {
        val club = getClubForUser(principal)
        val courses = courseRepository.findByClubId(club.id!!)
        return ClubCourseStats(
            totalCourses = courses.size,
            activeCourses = courses.count { it.active },
            totalCapacity = courses.sumOf { it.capacity ?: 0 }
        )
    }

    @GetMapping("/courses/{courseId}")
    @Transactional(readOnly = true)
    fun getCourse(
        @AuthenticationPrincipal principal: UserPrincipal,
        @PathVariable courseId: UUID
    ): CourseResponse {
        val club = getClubForUser(principal)
        val course = courseRepository.findById(courseId).orElseThrow {
            ResponseStatusException(HttpStatus.NOT_FOUND, "Course not found")
        }
        if (course.club?.id != club.id) {
            throw ResponseStatusException(HttpStatus.NOT_FOUND, "Course not found")
        }
        return courseService.getCourseForClub(courseId)
    }

    @PostMapping("/courses")
    @Transactional
    fun createCourse(
        @AuthenticationPrincipal principal: UserPrincipal,
        @Valid @RequestBody request: CreateClubCourseRequest
    ): CourseResponse {
        val club = getClubForUser(principal)
        val clubCoachUserIds = club.coaches.mapNotNull { it.user.id }

        if (!clubCoachUserIds.contains(request.coachId)) {
            throw ResponseStatusException(HttpStatus.FORBIDDEN, "Coach does not belong to this club")
        }

        val paymentRecipientNormalized = request.paymentRecipient.trim().uppercase()
        if (paymentRecipientNormalized != "COACH" && paymentRecipientNormalized != "CLUB") {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "paymentRecipient invalid (COACH sau CLUB)")
        }
        if (paymentRecipientNormalized == "COACH") {
            val coachProfile = club.coaches.find { it.user.id == request.coachId }
            if (coachProfile == null || !coachProfile.canReceivePayments()) {
                throw ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Nu poți seta încasările pe antrenor: Stripe este lipsă/inactiv pentru antrenorul selectat."
                )
            }
        }

        val payload = CourseRequest(
            name = request.name.trim(),
            sport = request.sport.trim(),
            level = request.level?.trim(),
            ageFrom = request.ageFrom,
            ageTo = request.ageTo,
            coachId = request.coachId,
            locationId = request.locationId,
            capacity = request.capacity,
            price = request.price,
            pricePerSession = request.pricePerSession,
            packageOptions = request.packageOptions?.trim(),
            recurrenceRule = request.recurrenceRule.trim(),
            active = request.active,
            description = request.description?.trim(),
            heroPhoto = request.heroPhoto,
            clubId = club.id,
            paymentRecipient = paymentRecipientNormalized
        )

        return courseService.createCourse(payload)
    }

    @PutMapping("/courses/{courseId}")
    @Transactional
    fun updateCourse(
        @AuthenticationPrincipal principal: UserPrincipal,
        @PathVariable courseId: UUID,
        @Valid @RequestBody request: UpdateClubCourseRequest
    ): CourseResponse {
        val club = getClubForUser(principal)
        val existing = courseRepository.findById(courseId).orElseThrow {
            ResponseStatusException(HttpStatus.NOT_FOUND, "Course not found")
        }
        if (existing.club?.id != club.id) {
            throw ResponseStatusException(HttpStatus.NOT_FOUND, "Course not found")
        }

        val clubCoachUserIds = club.coaches.mapNotNull { it.user.id }
        if (!clubCoachUserIds.contains(request.coachId)) {
            throw ResponseStatusException(HttpStatus.FORBIDDEN, "Coach does not belong to this club")
        }

        val paymentRecipientNormalized = request.paymentRecipient.trim().uppercase()
        if (paymentRecipientNormalized != "COACH" && paymentRecipientNormalized != "CLUB") {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "paymentRecipient invalid (COACH sau CLUB)")
        }
        if (paymentRecipientNormalized == "COACH") {
            val coachProfile = club.coaches.find { it.user.id == request.coachId }
            if (coachProfile == null || !coachProfile.canReceivePayments()) {
                throw ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Nu poți seta încasările pe antrenor: Stripe este lipsă/inactiv pentru antrenorul selectat."
                )
            }
        }

        val payload = CourseRequest(
            name = request.name.trim(),
            sport = request.sport.trim(),
            level = request.level?.trim(),
            ageFrom = request.ageFrom,
            ageTo = request.ageTo,
            coachId = request.coachId,
            locationId = request.locationId,
            capacity = request.capacity,
            price = request.price,
            pricePerSession = request.pricePerSession,
            packageOptions = request.packageOptions?.trim(),
            recurrenceRule = request.recurrenceRule.trim(),
            active = request.active,
            description = request.description?.trim(),
            heroPhoto = request.heroPhoto,
            clubId = club.id,
            paymentRecipient = paymentRecipientNormalized
        )

        return courseService.updateCourse(courseId, payload)
    }

    @PatchMapping("/courses/{courseId}/status")
    @Transactional
    fun updateCourseStatus(
        @AuthenticationPrincipal principal: UserPrincipal,
        @PathVariable courseId: UUID,
        @Valid @RequestBody request: ClubCourseStatusRequest
    ): ResponseEntity<Map<String, Boolean>> {
        val club = getClubForUser(principal)
        val course = courseRepository.findById(courseId).orElseThrow {
            ResponseStatusException(HttpStatus.NOT_FOUND, "Course not found")
        }
        if (course.club?.id != club.id) {
            throw ResponseStatusException(HttpStatus.NOT_FOUND, "Course not found")
        }
        adminCourseService.updateStatus(courseId, request.active)
        return ResponseEntity.ok(mapOf("success" to true))
    }

    @DeleteMapping("/courses/{courseId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Transactional
    fun deleteCourse(
        @AuthenticationPrincipal principal: UserPrincipal,
        @PathVariable courseId: UUID,
        @RequestParam(required = false, defaultValue = "false") force: Boolean
    ) {
        val club = getClubForUser(principal)
        val course = courseRepository.findById(courseId).orElseThrow {
            ResponseStatusException(HttpStatus.NOT_FOUND, "Course not found")
        }
        if (course.club?.id != club.id) {
            throw ResponseStatusException(HttpStatus.NOT_FOUND, "Course not found")
        }
        adminCourseService.deleteCourse(courseId, force)
    }

    private fun Course.toClubResponse() = ClubCourseResponse(
        id = this.id!!,
        name = this.name,
        description = this.description,
        sport = this.sport.name,
        coachName = this.coach.name,
        coachId = this.coach.id!!,
        locationName = this.location.name,
        locationId = this.location.id!!,
        price = this.price,
        pricePerSession = this.pricePerSession,
        currency = this.currency,
        capacity = this.capacity,
        level = this.level,
        ageFrom = this.ageFrom,
        ageTo = this.ageTo,
        isActive = this.active
    )

    // ============================================
    // Announcements Management
    // ============================================

    @GetMapping("/announcements")
    @Transactional(readOnly = true)
    fun listAnnouncements(@AuthenticationPrincipal principal: UserPrincipal): List<ClubAnnouncementResponse> {
        val club = getClubForUser(principal)
        return clubAnnouncementRepository.findByClubIdOrderByCreatedAtDesc(club.id!!)
            .map { it.toResponse() }
    }

    @PostMapping("/announcements")
    @Transactional
    fun createAnnouncement(
        @AuthenticationPrincipal principal: UserPrincipal,
        @Valid @RequestBody request: CreateClubAnnouncementRequest
    ): ClubAnnouncementResponse {
        val club = getClubForUser(principal)
        
        val trimmedTitle = request.title.trim()
        val trimmedContent = request.content.trim()
        
        if (trimmedTitle.isBlank()) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Title cannot be empty")
        }
        if (trimmedContent.isBlank()) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Content cannot be empty")
        }
        
        val announcement = ClubAnnouncement().apply {
            this.club = club
            this.author = principal.user
            this.title = trimmedTitle
            this.content = trimmedContent
            this.priority = request.priority?.let { AnnouncementPriority.valueOf(it) } ?: AnnouncementPriority.NORMAL
            this.isActive = true
        }
        
        val saved = clubAnnouncementRepository.save(announcement)
        logger.info("📢 Announcement created: ${saved.title} for club ${club.name}")
        return saved.toResponse()
    }

    @PutMapping("/announcements/{id}")
    @Transactional
    fun updateAnnouncement(
        @AuthenticationPrincipal principal: UserPrincipal,
        @PathVariable id: UUID,
        @Valid @RequestBody request: UpdateClubAnnouncementRequest
    ): ClubAnnouncementResponse {
        val club = getClubForUser(principal)
        val announcement = clubAnnouncementRepository.findByClubIdAndId(club.id!!, id)
            ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "Announcement not found")
        
        request.title?.let { 
            val trimmed = it.trim()
            if (trimmed.isBlank()) {
                throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Title cannot be empty")
            }
            announcement.title = trimmed 
        }
        request.content?.let { 
            val trimmed = it.trim()
            if (trimmed.isBlank()) {
                throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Content cannot be empty")
            }
            announcement.content = trimmed 
        }
        request.priority?.let { announcement.priority = AnnouncementPriority.valueOf(it) }
        request.isActive?.let { announcement.isActive = it }
        
        val saved = clubAnnouncementRepository.save(announcement)
        logger.info("📢 Announcement updated: ${saved.title}")
        return saved.toResponse()
    }

    @DeleteMapping("/announcements/{id}")
    @Transactional
    fun deleteAnnouncement(
        @AuthenticationPrincipal principal: UserPrincipal,
        @PathVariable id: UUID
    ): ResponseEntity<Map<String, String>> {
        val club = getClubForUser(principal)
        val announcement = clubAnnouncementRepository.findByClubIdAndId(club.id!!, id)
            ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "Announcement not found")
        
        clubAnnouncementRepository.delete(announcement)
        logger.info("🗑️ Announcement deleted: ${announcement.title}")
        return ResponseEntity.ok(mapOf("message" to "Announcement deleted"))
    }

    private fun ClubAnnouncement.toResponse() = ClubAnnouncementResponse(
        id = this.id!!,
        title = this.title,
        content = this.content,
        priority = this.priority.name,
        isActive = this.isActive,
        authorName = this.author.name,
        createdAt = this.createdAt.toString(),
        updatedAt = this.updatedAt.toString()
    )

    // ============================================
    // Helper Methods
    // ============================================

    private fun getClubForUser(principal: UserPrincipal): Club {
        return clubRepository.findByOwnerId(principal.user.id!!)
            ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "Club not found for this user")
    }

    private fun Club.toProfileResponse(): ClubProfileResponse {
        val clubId = this.id!!

        return ClubProfileResponse(
            id = clubId,
            name = this.name,
            description = this.description,
            logoUrl = resolveLogoUrl(clubId),
            website = this.website,
            phone = this.phone,
            email = this.email,
            publicEmailConsent = this.publicEmailConsent,
            address = this.address,
            city = this.city,
            stripeOnboardingComplete = this.stripeOnboardingComplete,
            canReceivePayments = this.canReceivePayments(),
            companyName = this.companyName,
            companyCui = this.companyCui,
            companyRegNumber = this.companyRegNumber,
            companyAddress = this.companyAddress,
            bankAccount = this.bankAccount,
            bankName = this.bankName,
            sports = this.sports.map { it.name },
            hasLogo = this.logo != null || !this.logoUrl.isNullOrBlank(),
            hasHeroPhoto = this.heroPhoto != null,
            heroPhotoUrl = if (this.heroPhoto != null) "/api/public/clubs/$clubId/hero-photo" else null
        )
    }

    private fun Club.resolveLogoUrl(clubId: UUID): String? {
        this.logoUrl?.takeIf { it.isNotBlank() }?.let { return it }
        if (this.logo != null) {
            return "/api/public/clubs/$clubId/logo"
        }
        return null
    }
}

// ============================================
// DTOs
// ============================================

data class ClubProfileResponse(
    val id: UUID,
    val name: String,
    val description: String?,
    val logoUrl: String?,
    val website: String?,
    val phone: String?,
    val email: String?,
    val publicEmailConsent: Boolean,
    val address: String?,
    val city: String?,
    val stripeOnboardingComplete: Boolean,
    val canReceivePayments: Boolean,
    val companyName: String?,
    val companyCui: String?,
    val companyRegNumber: String?,
    val companyAddress: String?,
    val bankAccount: String?,
    val bankName: String?,
    val sports: List<String>,
    val hasLogo: Boolean,
    val hasHeroPhoto: Boolean,
    val heroPhotoUrl: String?
)

data class UpdateClubProfileRequest(
    val name: String? = null,
    val description: String? = null,
    val phone: String? = null,
    val email: String? = null,
    val publicEmailConsent: Boolean? = null,
    val address: String? = null,
    val city: String? = null,
    val website: String? = null,
    // Company / Billing Info (for invoicing)
    val companyName: String? = null,
    val companyCui: String? = null,
    val companyRegNumber: String? = null,
    val companyAddress: String? = null,
    val bankAccount: String? = null,
    val bankName: String? = null
)

data class UploadClubLogoRequest(
    @field:NotBlank
    val logo: String
)

data class UploadClubHeroPhotoRequest(
    @field:NotBlank
    val photo: String
)

data class ClubDashboardStats(
    val coachCount: Int,
    val activeInvitationCodes: Int,
    val stripeOnboardingComplete: Boolean,
    val canReceivePayments: Boolean
)

data class ClubCoachResponse(
    val id: UUID,
    val userId: UUID,
    val name: String,
    val email: String,
    val phone: String?,
    val sports: List<String>,
    val stripeOnboardingComplete: Boolean,
    val canReceivePayments: Boolean,
    val avatarUrl: String?,
    val hasPhoto: Boolean
)

data class ClubCoachDetailResponse(
    val id: UUID,
    val userId: UUID,
    val name: String,
    val email: String,
    val phone: String?,
    val bio: String?,
    val sportIds: List<UUID>,
    val sports: List<String>,
    val stripeOnboardingComplete: Boolean,
    val canReceivePayments: Boolean,
    val avatarUrl: String?,
    val hasPhoto: Boolean
)

data class CreateClubCoachRequest(
    @field:NotBlank(message = "Numele este obligatoriu")
    val name: String,
    @field:NotBlank(message = "Email-ul este obligatoriu")
    @field:Email(message = "Email invalid")
    val email: String,
    @field:NotBlank(message = "Parola este obligatorie")
    @field:Size(min = 8, message = "Parola trebuie să aibă minim 8 caractere")
    val password: String,
    val phone: String? = null,
    val bio: String? = null,
    val sportIds: List<UUID>? = null,
    val photo: String? = null
)

data class UpdateClubCoachRequest(
    @field:NotBlank(message = "Numele este obligatoriu")
    val name: String,
    @field:NotBlank(message = "Email-ul este obligatoriu")
    @field:Email(message = "Email invalid")
    val email: String,
    val password: String? = null,
    val phone: String? = null,
    val bio: String? = null,
    val sportIds: List<UUID>? = null,
    val photo: String? = null
)

data class CreateInvitationCodeRequest(
    @field:Min(1)
    @field:Max(100)
    val maxUses: Int = 1,
    val expiresInDays: Int? = 30,
    val notes: String? = null,
    val coachNameHint: String? = null
)

// Location DTOs
data class ClubLocationResponse(
    val id: UUID,
    val name: String,
    val address: String?,
    val city: String?,
    val description: String?,
    val capacity: Int?,
    @get:com.fasterxml.jackson.annotation.JsonProperty("isActive")
    val isActive: Boolean,
    val lat: Double?,
    val lng: Double?,
    val type: String?
)

data class CreateClubLocationRequest(
    @field:NotBlank(message = "Numele locației este obligatoriu")
    val name: String,
    val address: String? = null,
    val city: String? = null,
    val description: String? = null,
    val capacity: Int? = null,
    val lat: Double? = null,
    val lng: Double? = null,
    val type: String? = null  // POOL, GYM, OUTDOOR, TRACK, OTHER
)

data class UpdateClubLocationRequest(
    val name: String? = null,
    val address: String? = null,
    val city: String? = null,
    val description: String? = null,
    val capacity: Int? = null,
    val isActive: Boolean? = null,
    val lat: Double? = null,
    val lng: Double? = null,
    val type: String? = null
)

// Course DTOs
data class ClubCourseResponse(
    val id: UUID,
    val name: String,
    val description: String?,
    val sport: String,
    val coachName: String,
    val coachId: UUID,
    val locationName: String,
    val locationId: UUID,
    val price: Long,
    val pricePerSession: Long,
    val currency: String,
    val capacity: Int?,
    val level: String?,
    val ageFrom: Int?,
    val ageTo: Int?,
    @get:com.fasterxml.jackson.annotation.JsonProperty("isActive")
    val isActive: Boolean
)

data class ClubCourseStats(
    val totalCourses: Int,
    val activeCourses: Int,
    val totalCapacity: Int
)

data class CreateClubCourseRequest(
    @field:NotBlank(message = "Numele cursului este obligatoriu")
    val name: String,
    @field:NotBlank(message = "Sportul este obligatoriu")
    val sport: String,
    val level: String? = null,
    val ageFrom: Int? = null,
    val ageTo: Int? = null,
    val coachId: UUID,
    val locationId: UUID,
    val capacity: Int? = null,
    val price: Long,
    val pricePerSession: Long,
    val packageOptions: String? = null,
    @field:NotBlank(message = "Programul (recurrenceRule) este obligatoriu")
    val recurrenceRule: String,
    val active: Boolean = true,
    val description: String? = null,
    val heroPhoto: String? = null,
    val paymentRecipient: String = "CLUB"
)

data class UpdateClubCourseRequest(
    @field:NotBlank(message = "Numele cursului este obligatoriu")
    val name: String,
    @field:NotBlank(message = "Sportul este obligatoriu")
    val sport: String,
    val level: String? = null,
    val ageFrom: Int? = null,
    val ageTo: Int? = null,
    val coachId: UUID,
    val locationId: UUID,
    val capacity: Int? = null,
    val price: Long,
    val pricePerSession: Long,
    val packageOptions: String? = null,
    @field:NotBlank(message = "Programul (recurrenceRule) este obligatoriu")
    val recurrenceRule: String,
    val active: Boolean,
    val description: String? = null,
    val heroPhoto: String? = null,
    val paymentRecipient: String = "CLUB"
)

data class ClubCourseStatusRequest(
    val active: Boolean
)

// Announcement DTOs
data class ClubAnnouncementResponse(
    val id: UUID,
    val title: String,
    val content: String,
    val priority: String,
    @get:com.fasterxml.jackson.annotation.JsonProperty("isActive")
    val isActive: Boolean,
    val authorName: String,
    val createdAt: String,
    val updatedAt: String
)

data class CreateClubAnnouncementRequest(
    @field:NotBlank(message = "Titlul este obligatoriu")
    val title: String,
    @field:NotBlank(message = "Conținutul este obligatoriu")
    val content: String,
    val priority: String? = null
)

data class UpdateClubAnnouncementRequest(
    val title: String? = null,
    val content: String? = null,
    val priority: String? = null,
    val isActive: Boolean? = null
)
