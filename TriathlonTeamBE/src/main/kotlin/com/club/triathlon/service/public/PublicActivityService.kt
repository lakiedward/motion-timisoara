package com.club.triathlon.service.public

import com.club.triathlon.enums.EnrollmentKind
import com.club.triathlon.enums.EnrollmentStatus
import com.club.triathlon.repo.ActivityRepository
import com.club.triathlon.repo.CoachProfileRepository
import com.club.triathlon.repo.EnrollmentRepository
import org.slf4j.LoggerFactory
import org.springframework.http.HttpStatus
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.server.ResponseStatusException
import java.time.LocalDate
import java.util.UUID

@Service
class PublicActivityService(
    private val activityRepository: ActivityRepository,
    private val coachProfileRepository: CoachProfileRepository,
    private val enrollmentRepository: EnrollmentRepository
) {
    private val logger = LoggerFactory.getLogger(PublicActivityService::class.java)

    /**
     * List all active activities that are scheduled for today or future dates
     */
    @Transactional(readOnly = true)
    fun listUpcomingActivities(): List<PublicActivitySummaryDto> {
        logger.info("📋 [PUBLIC] Fetching upcoming activities")
        
        val today = LocalDate.now()
        val activities = activityRepository.findUpcomingActiveWithDetails(today)
        
        logger.info("✅ [PUBLIC] Found ${activities.size} upcoming activities")
        
        return activities.map { activity ->
            val enrolledCount = countEnrollments(activity.id!!)
            val spotsLeft = activity.capacity?.let { it - enrolledCount }?.coerceAtLeast(0)
            
            PublicActivitySummaryDto(
                id = activity.id!!,
                name = activity.name,
                sport = PublicSportDto(
                    id = activity.sport.id!!,
                    code = activity.sport.code,
                    name = activity.sport.name
                ),
                activityDate = activity.activityDate.toString(),
                startTime = activity.startTime.toString().substring(0, 5),
                endTime = activity.endTime.toString().substring(0, 5),
                locationId = activity.location.id!!,
                location = activity.location.name,
                price = activity.price,
                currency = activity.currency,
                capacity = activity.capacity,
                spotsLeft = spotsLeft,
                hasHeroPhoto = !activity.heroPhoto.isNullOrBlank(),
                heroPhotoUrl = if (!activity.heroPhoto.isNullOrBlank()) 
                    "/api/public/activities/${activity.id}/hero-photo" else null
            )
        }
    }

    @Transactional(readOnly = true)
    fun listAllActiveActivities(): List<PublicActivitySummaryDto> {
        logger.info("📋 [PUBLIC] Fetching all active activities")

        val activities = activityRepository.findAllActiveWithDetails()

        logger.info("✅ [PUBLIC] Found ${activities.size} active activities")

        return activities.map { activity ->
            val enrolledCount = countEnrollments(activity.id!!)
            val spotsLeft = activity.capacity?.let { it - enrolledCount }?.coerceAtLeast(0)

            PublicActivitySummaryDto(
                id = activity.id!!,
                name = activity.name,
                sport = PublicSportDto(
                    id = activity.sport.id!!,
                    code = activity.sport.code,
                    name = activity.sport.name
                ),
                activityDate = activity.activityDate.toString(),
                startTime = activity.startTime.toString().substring(0, 5),
                endTime = activity.endTime.toString().substring(0, 5),
                locationId = activity.location.id!!,
                location = activity.location.name,
                price = activity.price,
                currency = activity.currency,
                capacity = activity.capacity,
                spotsLeft = spotsLeft,
                hasHeroPhoto = !activity.heroPhoto.isNullOrBlank(),
                heroPhotoUrl = if (!activity.heroPhoto.isNullOrBlank())
                    "/api/public/activities/${activity.id}/hero-photo" else null
            )
        }
    }

    /**
     * Get detailed information about a specific activity
     */
    @Transactional(readOnly = true)
    fun getActivityDetail(activityId: UUID): PublicActivityDetailDto {
        logger.info("🎯 [PUBLIC] Getting activity details for ID: $activityId")
        
        val activity = activityRepository.findById(activityId).orElseThrow {
            logger.warn("❌ [PUBLIC] Activity not found: $activityId")
            ResponseStatusException(HttpStatus.NOT_FOUND, "Activity not found")
        }
        
        if (!activity.active) {
            logger.warn("❌ [PUBLIC] Activity is inactive: $activityId")
            throw ResponseStatusException(HttpStatus.NOT_FOUND, "Activity not found")
        }
        
        val coach = activity.coach
        val coachProfile = coachProfileRepository.findByUser(coach)
        val location = activity.location
        val sport = activity.sport
        
        val enrolledCount = countEnrollments(activityId)
        val spotsLeft = activity.capacity?.let { it - enrolledCount }?.coerceAtLeast(0)
        
        val heroPhotoUrl = if (!activity.heroPhoto.isNullOrBlank()) {
            "/api/public/activities/$activityId/hero-photo"
        } else null
        
        logger.info("✅ [PUBLIC] Activity details prepared for: ${activity.name}")
        
        return PublicActivityDetailDto(
            id = activityId,
            name = activity.name,
            description = activity.description?.trim(),
            sport = PublicSportDto(
                id = sport.id!!,
                code = sport.code,
                name = sport.name
            ),
            activityDate = activity.activityDate.toString(),
            startTime = activity.startTime.toString().substring(0, 5),
            endTime = activity.endTime.toString().substring(0, 5),
            price = activity.price,
            currency = activity.currency,
            capacity = activity.capacity,
            spotsLeft = spotsLeft,
            enrolledCount = enrolledCount,
            heroPhotoUrl = heroPhotoUrl,
            coach = PublicActivityCoachDto(
                id = coach.id!!,
                name = coach.name,
                avatarUrl = resolveCoachAvatarUrl(coach.id!!, coachProfile)
            ),
            location = PublicLocationDto(
                id = location.id!!,
                name = location.name,
                lat = location.lat,
                lng = location.lng
            )
        )
    }

    private fun countEnrollments(activityId: UUID): Int {
        return try {
            enrollmentRepository.findAll()
                .count { 
                    it.kind == EnrollmentKind.ACTIVITY && 
                    it.entityId == activityId && 
                    it.status == EnrollmentStatus.ACTIVE 
                }
        } catch (e: Exception) {
            logger.warn("Failed to count enrollments for activity $activityId: ${e.message}")
            0
        }
    }

    private fun resolveCoachAvatarUrl(coachId: UUID, profile: com.club.triathlon.domain.CoachProfile?): String? {
        profile?.avatarUrl?.takeIf { it.isNotBlank() }?.let { return it }
        if (profile?.photo != null) {
            return "/api/public/coaches/$coachId/photo"
        }
        return null
    }
}

// DTOs
data class PublicActivitySummaryDto(
    val id: UUID,
    val name: String,
    val sport: PublicSportDto,
    val activityDate: String,
    val startTime: String,
    val endTime: String,
    val locationId: UUID,
    val location: String,
    val price: Long,
    val currency: String,
    val capacity: Int?,
    val spotsLeft: Int?,
    val hasHeroPhoto: Boolean,
    val heroPhotoUrl: String?
)

data class PublicActivityDetailDto(
    val id: UUID,
    val name: String,
    val description: String?,
    val sport: PublicSportDto,
    val activityDate: String,
    val startTime: String,
    val endTime: String,
    val price: Long,
    val currency: String,
    val capacity: Int?,
    val spotsLeft: Int?,
    val enrolledCount: Int,
    val heroPhotoUrl: String?,
    val coach: PublicActivityCoachDto,
    val location: PublicLocationDto
)

data class PublicActivityCoachDto(
    val id: UUID,
    val name: String,
    val avatarUrl: String?
)
