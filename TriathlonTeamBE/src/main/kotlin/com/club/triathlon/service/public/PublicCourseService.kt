package com.club.triathlon.service.public

import com.club.triathlon.domain.Course
import com.club.triathlon.enums.EnrollmentKind
import com.club.triathlon.enums.EnrollmentStatus
import com.club.triathlon.repo.CoachProfileRepository
import com.club.triathlon.repo.CourseOccurrenceRepository
import com.club.triathlon.repo.CoursePhotoRepository
import com.club.triathlon.repo.CourseRatingRepository
import com.club.triathlon.repo.CourseRepository
import com.club.triathlon.repo.EnrollmentRepository
import com.club.triathlon.web.public.CoursePhotoSummaryDto
import com.club.triathlon.service.storage.StorageService
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.http.HttpStatus
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.server.ResponseStatusException
import java.time.OffsetDateTime
import java.util.UUID

@Service
class PublicCourseService(
    private val courseRepository: CourseRepository,
    private val courseOccurrenceRepository: CourseOccurrenceRepository,
    private val coachProfileRepository: CoachProfileRepository,
    private val coursePhotoRepository: CoursePhotoRepository,
    private val courseRatingRepository: CourseRatingRepository,
    private val enrollmentRepository: EnrollmentRepository
) {

    @Autowired(required = false)
    private var storageService: StorageService? = null

    private val logger = LoggerFactory.getLogger(PublicCourseService::class.java)

    @Transactional(readOnly = true)
    fun getCourseDetail(courseId: UUID): PublicCourseDetailDto {
        logger.info("🎯 [PUBLIC] Getting course details for ID: $courseId")
        
        val course = courseRepository.findById(courseId).orElseThrow {
            logger.warn("❌ [PUBLIC] Course not found: $courseId")
            ResponseStatusException(HttpStatus.NOT_FOUND, "Course not found")
        }
        
        if (!course.active) {
            logger.warn("❌ [PUBLIC] Course is inactive: $courseId")
            throw ResponseStatusException(HttpStatus.NOT_FOUND, "Course not found")
        }
        
        logger.info("✅ [PUBLIC] Found course: ${course.name}")
        
        // Get coach profile
        val coachProfile = coachProfileRepository.findByUser(course.coach)
        
        // Get all occurrences for this course
        val allOccurrences = courseOccurrenceRepository.findAllByCourse(course)
            .sortedBy { it.startsAt }
        
        // Get occurrences that start after now
        val upcomingOccurrences = allOccurrences.filter { 
            it.startsAt.isAfter(OffsetDateTime.now()) 
        }
        
        // Calculate duration from first occurrence
        val durationMinutes = allOccurrences.firstOrNull()?.let { occurrence ->
            val minutes = java.time.Duration.between(occurrence.startsAt, occurrence.endsAt).toMinutes()
            if (minutes > 0) minutes.toInt() else null
        }
        
        val heroPhotoUrl = course.heroPhotoS3Key?.let { key ->
            storageService?.generatePresignedUrl(key)
        } ?: if (course.heroPhoto != null) {
            "/api/public/courses/$courseId/hero-photo"
        } else null

        // Get gallery photos
        val galleryPhotos = coursePhotoRepository.findByCourseOrderByDisplayOrder(course)
            .map { photo ->
                photo.photoS3Key?.let { key ->
                    storageService?.generatePresignedUrl(key)
                } ?: "/api/public/courses/$courseId/photos/${photo.id}"
            }
        
        val sport = course.sport
        val coach = course.coach
        val location = course.location
        
        // Get rating information
        val avgRating = courseRatingRepository.getAverageRatingByCourseId(courseId)
        val ratingCount = courseRatingRepository.countByCourseId(courseId)
        
        // Calculate spots left
        val activeStatuses = listOf(EnrollmentStatus.ACTIVE, EnrollmentStatus.PENDING)
        val enrolledCount = enrollmentRepository.countByKindAndEntityIdAndStatusIn(
            EnrollmentKind.COURSE, courseId, activeStatuses
        )
        val spotsLeft = course.capacity?.let { it - enrolledCount.toInt() }?.coerceAtLeast(0)
        
        val courseDetail = PublicCourseDetailDto(
            id = courseId,
            name = course.name,
            sport = PublicSportDto(
                id = sport.id!!,
                code = sport.code,
                name = sport.name
            ),
            level = course.level,
            ageFrom = course.ageFrom,
            ageTo = course.ageTo,
            capacity = course.capacity,
            spotsLeft = spotsLeft,
            price = course.price,
            pricePerSession = course.pricePerSession,
            currency = course.currency,
            packageOptions = course.packageOptions,
            active = course.active,
            durationMinutes = durationMinutes,
            description = course.description?.trim(),
            heroPhotoUrl = heroPhotoUrl,
            gallery = galleryPhotos,
            coach = PublicCoachDetailDto(
                id = coach.id!!,
                name = coach.name,
                avatarUrl = resolveAvatarUrl(coach.id!!, coachProfile),
                summary = extractSummary(coachProfile),
                biography = coachProfile?.bio?.trim(),
                focusAreas = extractFocusAreas(coachProfile),
                disciplines = extractDisciplines(course)
            ),
            location = PublicLocationDto(
                id = location.id!!,
                name = location.name,
                lat = location.lat,
                lng = location.lng
            ),
            occurrences = allOccurrences.map { occurrence ->
                PublicCourseOccurrenceDto(
                    id = occurrence.id!!,
                    startTime = occurrence.startsAt.toString(),
                    endTime = occurrence.endsAt.toString()
                )
            },
            averageRating = avgRating,
            totalRatings = ratingCount
        )
        
        logger.info("✅ [PUBLIC] Course details prepared for: ${course.name}")
        return courseDetail
    }
    
    @Transactional(readOnly = true)
    fun getCoursePhotos(courseId: UUID): List<CoursePhotoSummaryDto> {
        logger.info("📷 [PUBLIC] Getting course photos for ID: $courseId")
        
        val course = courseRepository.findById(courseId).orElseThrow {
            logger.warn("❌ [PUBLIC] Course not found: $courseId")
            ResponseStatusException(HttpStatus.NOT_FOUND, "Course not found")
        }
        
        if (!course.active) {
            logger.warn("❌ [PUBLIC] Course is inactive: $courseId")
            throw ResponseStatusException(HttpStatus.NOT_FOUND, "Course not found")
        }
        
        val photos = coursePhotoRepository.findByCourseOrderByDisplayOrder(course)
            .map { CoursePhotoSummaryDto(it.id!!, it.displayOrder) }
        
        logger.info("✅ [PUBLIC] Found ${photos.size} photos for course: ${course.name}")
        return photos
    }
    
    private fun extractSummary(profile: com.club.triathlon.domain.CoachProfile?): String? {
        return profile?.bio?.trim()?.takeIf { it.isNotBlank() }?.let { bio ->
            if (bio.length > 150) bio.substring(0, 147) + "..." else bio
        }
    }
    
    private fun extractFocusAreas(profile: com.club.triathlon.domain.CoachProfile?): List<String> {
        return profile?.sports
            ?.mapNotNull { sport -> sport.name?.trim() }
            ?.filter { it.isNotEmpty() }
            ?.sorted()
            ?: emptyList()
    }
    
    private fun resolveAvatarUrl(coachId: UUID, profile: com.club.triathlon.domain.CoachProfile?): String? {
        // If avatarUrl is set and not empty, use it (external URL)
        profile?.avatarUrl?.takeIf { it.isNotBlank() }?.let { return it }

        // If photo is stored in S3, return presigned URL
        profile?.photoS3Key?.let { key ->
            storageService?.let { return it.generatePresignedUrl(key) }
        }

        // If photo is stored in database, return endpoint URL
        if (profile?.photo != null) {
            return "/api/public/coaches/$coachId/photo"
        }

        return null
    }
    
    private fun extractDisciplines(course: Course): List<PublicDisciplineDto> {
        val sport = course.sport
        return listOf(
            PublicDisciplineDto(
                sport = PublicSportDto(
                    id = sport.id!!,
                    code = sport.code,
                    name = sport.name
                ),
                levels = listOfNotNull(course.level)
            )
        )
    }
}

data class PublicCourseDetailDto(
    val id: UUID,
    val name: String,
    val sport: PublicSportDto,
    val level: String?,
    val ageFrom: Int?,
    val ageTo: Int?,
    val capacity: Int?,
    val spotsLeft: Int?,
    val price: Long,
    val pricePerSession: Long,
    val currency: String,
    val packageOptions: String?,
    val active: Boolean,
    val durationMinutes: Int?,
    val description: String?,
    val heroPhotoUrl: String?,
    val gallery: List<String>,
    val coach: PublicCoachDetailDto,
    val location: PublicLocationDto,
    val occurrences: List<PublicCourseOccurrenceDto>,
    val averageRating: Double?,
    val totalRatings: Long
)

data class PublicCoachDetailDto(
    val id: UUID,
    val name: String,
    val avatarUrl: String?,
    val summary: String?,
    val biography: String?,
    val focusAreas: List<String>,
    val disciplines: List<PublicDisciplineDto>
)

data class PublicCourseOccurrenceDto(
    val id: UUID,
    val startTime: String,
    val endTime: String
)

data class PublicDisciplineDto(
    val sport: PublicSportDto,
    val levels: List<String>
)
