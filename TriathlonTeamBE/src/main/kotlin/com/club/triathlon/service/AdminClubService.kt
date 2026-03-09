package com.club.triathlon.service

import com.club.triathlon.domain.Club
import com.club.triathlon.repo.ActivityRepository
import com.club.triathlon.repo.ClubAnnouncementRepository
import com.club.triathlon.repo.ClubInvitationCodeRepository
import com.club.triathlon.repo.ClubRepository
import com.club.triathlon.repo.CourseRepository
import com.club.triathlon.repo.LocationRepository
import com.club.triathlon.repo.SportRepository
import com.club.triathlon.repo.UserRecentLocationRepository
import com.club.triathlon.service.storage.StorageService
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.http.HttpStatus
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.server.ResponseStatusException
import java.net.URI
import java.util.UUID

@Service
class AdminClubService(
    private val clubRepository: ClubRepository,
    private val courseRepository: CourseRepository,
    private val activityRepository: ActivityRepository,
    private val locationRepository: LocationRepository,
    private val userRecentLocationRepository: UserRecentLocationRepository,
    private val clubAnnouncementRepository: ClubAnnouncementRepository,
    private val clubInvitationCodeRepository: ClubInvitationCodeRepository,
    private val stripeConnectService: StripeConnectService,
    private val adminCourseService: AdminCourseService,
    private val adminActivityService: AdminActivityService,
    private val sportRepository: SportRepository
) {
    private val logger = LoggerFactory.getLogger(AdminClubService::class.java)

    @Autowired(required = false)
    private var storageService: StorageService? = null

    @Transactional(readOnly = true)
    fun getAllClubs(): List<AdminClubDto> {
        logger.info("📋 [ADMIN] Fetching all clubs")
        val clubs = clubRepository.findAll()
        return clubs.map { club ->
            mapToDto(club)
        }
    }

    @Transactional(readOnly = true)
    fun getClubById(clubId: UUID): AdminClubDetailDto {
        logger.info("🏢 [ADMIN] Fetching club with ID: $clubId")
        val club = clubRepository.findById(clubId)
            .orElseThrow { IllegalArgumentException("Club not found with ID: $clubId") }
        return mapToDetailDto(club)
    }

    @Transactional
    fun setClubStatus(clubId: UUID, active: Boolean) {
        logger.info("🔄 [ADMIN] Setting club $clubId status to active=$active")
        val club = clubRepository.findById(clubId)
            .orElseThrow { IllegalArgumentException("Club not found with ID: $clubId") }
        
        // Update owner user's enabled status
        club.owner.enabled = active
        clubRepository.save(club)
        logger.info("✅ [ADMIN] Club status updated successfully")
    }

    @Transactional
    fun updateClub(clubId: UUID, request: com.club.triathlon.web.admin.UpdateClubRequest): AdminClubDto {
        logger.info("✏️ [ADMIN] Updating club with ID: $clubId")
        val club = clubRepository.findById(clubId)
            .orElseThrow { IllegalArgumentException("Club not found with ID: $clubId") }
        
        request.name?.let { club.name = it }
        request.email?.let { club.email = it }
        request.phone?.let { club.phone = it }
        request.description?.let { club.description = it }
        request.address?.let { club.address = it }
        request.city?.let { club.city = it }
        request.website?.let { club.website = it }
        
        // Company Info
        request.companyName?.let { club.companyName = it }
        request.companyCui?.let { club.companyCui = it }
        request.companyRegNumber?.let { club.companyRegNumber = it }
        request.companyAddress?.let { club.companyAddress = it }
        request.bankAccount?.let { club.bankAccount = it }
        request.bankName?.let { club.bankName = it }
        
        clubRepository.save(club)
        logger.info("✅ [ADMIN] Club updated successfully")
        return mapToDto(club)
    }

    @Transactional
    fun deleteClub(clubId: UUID, force: Boolean = false) {
        logger.info("🗑️ [ADMIN] Deleting club with ID: $clubId (force=$force)")
        val club = clubRepository.findById(clubId)
            .orElseThrow { IllegalArgumentException("Club not found with ID: $clubId") }
        
        val coachCount = club.coaches.size
        val courses = courseRepository.findByClubId(clubId)
        val activities = activityRepository.findByClubId(clubId)
        val locations = locationRepository.findByClubId(clubId)
        val announcements = clubAnnouncementRepository.findByClubIdOrderByCreatedAtDesc(clubId)
        val invitationCodes = clubInvitationCodeRepository.findByClub(club)

        if (!force && (
            coachCount > 0 ||
            courses.isNotEmpty() ||
            activities.isNotEmpty() ||
            locations.isNotEmpty() ||
            announcements.isNotEmpty() ||
            invitationCodes.isNotEmpty()
        )) {
            throw ResponseStatusException(
                HttpStatus.CONFLICT,
                "Nu se poate șterge clubul. Are $coachCount antrenori, ${courses.size} cursuri, ${activities.size} activități, ${locations.size} locații, ${announcements.size} anunțuri și ${invitationCodes.size} coduri. Folosește force=true pentru ștergere."
            )
        }

        if (force) {
            val hadCoaches = coachCount > 0
            val hadSports = club.sports.isNotEmpty()

            if (activities.isNotEmpty()) {
                logger.info("🗑️ [ADMIN] Force deleting ${activities.size} activities for club $clubId")
                activities.forEach { adminActivityService.deleteActivity(it.id!!, true) }
            }

            if (courses.isNotEmpty()) {
                logger.info("🗑️ [ADMIN] Force deleting ${courses.size} courses for club $clubId")
                courses.forEach { adminCourseService.deleteCourse(it.id!!, true) }
            }

            if (announcements.isNotEmpty()) {
                logger.info("🗑️ [ADMIN] Deleting ${announcements.size} club announcements for club $clubId")
                clubAnnouncementRepository.deleteAll(announcements)
            }

            if (invitationCodes.isNotEmpty()) {
                logger.info("🗑️ [ADMIN] Deleting ${invitationCodes.size} club invitation codes for club $clubId")
                clubInvitationCodeRepository.deleteAll(invitationCodes)
            }

            if (locations.isNotEmpty()) {
                logger.info("🗑️ [ADMIN] Deleting ${locations.size} club locations for club $clubId")
                locations.forEach { location ->
                    userRecentLocationRepository.deleteByLocationId(location.id!!)
                    locationRepository.delete(location)
                }
            }

            if (coachCount > 0) {
                logger.info("🗑️ [ADMIN] Disassociating $coachCount coaches from club $clubId")
                club.coaches.clear()
            }

            if (club.sports.isNotEmpty()) {
                club.sports.clear()
            }

            if (hadCoaches || hadSports) {
                clubRepository.save(club)
            }
        }

        club.stripeAccountId?.let { stripeAccountId ->
            stripeConnectService.deleteAccount(stripeAccountId)
        }

        clubRepository.delete(club)
        logger.info("✅ [ADMIN] Club deleted successfully")
    }

    @Transactional
    fun uploadLogo(clubId: UUID, base64Logo: String) {
        val club = clubRepository.findById(clubId)
            .orElseThrow { IllegalArgumentException("Club not found with ID: $clubId") }

        val photoData = com.club.triathlon.util.PhotoUtils.processPhoto(base64Logo)
        club.logoContentType = photoData.second
        club.logoUrl = null
        // Delete old S3 logo if exists
        club.logoS3Key?.let { oldKey -> storageService?.delete(oldKey) }
        storageService?.let { storage ->
            val key = storage.generateObjectKey("clubs/$clubId/logo", photoData.second)
            storage.upload(key, photoData.first, photoData.second)
            club.logoS3Key = key
            club.logo = null
        } ?: run {
            club.logo = photoData.first
        }

        clubRepository.save(club)
        logger.info("[ADMIN] Logo uploaded for club $clubId")
    }

    @Transactional(readOnly = true)
    fun getClubLogo(clubId: UUID): org.springframework.http.ResponseEntity<ByteArray> {
        val club = clubRepository.findById(clubId)
            .orElseThrow { ResponseStatusException(HttpStatus.NOT_FOUND, "Club not found") }

        // If S3 key exists, redirect to presigned URL
        club.logoS3Key?.let { key ->
            storageService?.let { storage ->
                val presignedUrl = storage.generatePresignedUrl(key)
                return org.springframework.http.ResponseEntity.status(HttpStatus.FOUND)
                    .location(URI.create(presignedUrl))
                    .build()
            }
        }

        if (club.logo == null) {
            throw ResponseStatusException(HttpStatus.NOT_FOUND, "Club has no logo")
        }

        val contentType = club.logoContentType?.let { org.springframework.http.MediaType.parseMediaType(it) }
            ?: org.springframework.http.MediaType.IMAGE_JPEG

        return org.springframework.http.ResponseEntity.ok()
            .contentType(contentType)
            .body(club.logo)
    }
    
    @Transactional
    fun updateClubSports(clubId: UUID, sportIds: List<UUID>) {
        val club = clubRepository.findById(clubId)
            .orElseThrow { IllegalArgumentException("Club not found with ID: $clubId") }
        
        val sports = sportRepository.findAllById(sportIds)
        club.sports = sports.toMutableSet()
        
        clubRepository.save(club)
    }

    private fun mapToDto(club: Club): AdminClubDto {
        val courseCount = courseRepository.countByClubId(club.id!!)
        
        return AdminClubDto(
            id = club.id!!,
            name = club.name,
            email = club.email ?: club.owner.email,
            phone = club.phone,
            description = club.description,
            address = club.address,
            city = club.city,
            website = club.website,
            createdAt = club.createdAt.toString(),
            active = club.owner.enabled,
            hasLogo = club.logoS3Key != null || club.logo != null || !club.logoUrl.isNullOrBlank(),
            coachCount = club.coaches.size,
            courseCount = courseCount.toInt(),
            stripeConnected = club.stripeOnboardingComplete
        )
    }

    private fun mapToDetailDto(club: Club): AdminClubDetailDto {
        val dto = mapToDto(club)
        val coaches = club.coaches.map { coach ->
            AdminClubCoachDto(
                id = coach.id!!,
                name = coach.user.name,
                email = coach.user.email
            )
        }
        
        return AdminClubDetailDto(
            id = dto.id,
            name = dto.name,
            email = dto.email,
            phone = dto.phone,
            description = dto.description,
            address = dto.address,
            city = dto.city,
            website = dto.website,
            createdAt = dto.createdAt,
            active = dto.active,
            hasLogo = dto.hasLogo,
            coachCount = dto.coachCount,
            courseCount = dto.courseCount,
            stripeConnected = dto.stripeConnected,
            coaches = coaches,
            companyName = club.companyName,
            companyCui = club.companyCui,
            companyRegNumber = club.companyRegNumber,
            companyAddress = club.companyAddress,
            bankAccount = club.bankAccount,
            bankName = club.bankName,
            sports = club.sports.map { sport ->
                AdminClubSportDto(
                    id = sport.id!!,
                    name = sport.name,
                    code = sport.code
                )
            }
        )
    }
}

data class AdminClubDto(
    val id: UUID,
    val name: String,
    val email: String,
    val phone: String?,
    val description: String?,
    val address: String?,
    val city: String?,
    val website: String?,
    val createdAt: String,
    val active: Boolean,
    val hasLogo: Boolean,
    val coachCount: Int,
    val courseCount: Int,
    val stripeConnected: Boolean
)

data class AdminClubDetailDto(
    val id: UUID,
    val name: String,
    val email: String,
    val phone: String?,
    val description: String?,
    val address: String?,
    val city: String?,
    val website: String?,
    val createdAt: String,
    val active: Boolean,
    val hasLogo: Boolean,
    val coachCount: Int,
    val courseCount: Int,
    val stripeConnected: Boolean,
    val coaches: List<AdminClubCoachDto>,
    val companyName: String?,
    val companyCui: String?,
    val companyRegNumber: String?,
    val companyAddress: String?,
    val bankAccount: String?,
    val bankName: String?,
    val sports: List<AdminClubSportDto>
)

data class AdminClubCoachDto(
    val id: UUID,
    val name: String,
    val email: String
)

data class AdminClubSportDto(
    val id: UUID,
    val name: String,
    val code: String
)
