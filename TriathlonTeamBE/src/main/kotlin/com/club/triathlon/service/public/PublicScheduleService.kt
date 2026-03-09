package com.club.triathlon.service.public

import com.club.triathlon.repo.CoachProfileRepository
import com.club.triathlon.repo.CourseOccurrenceRepository
import com.club.triathlon.repo.CourseRatingRepository
import com.club.triathlon.repo.CourseRepository
import com.club.triathlon.repo.ScheduleFilter
import org.springframework.data.domain.Page
import org.springframework.data.domain.PageImpl
import org.springframework.data.domain.Pageable
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Duration
import java.time.OffsetDateTime
import java.util.UUID

@Service
class PublicScheduleService(
    private val courseRepository: CourseRepository,
    private val courseOccurrenceRepository: CourseOccurrenceRepository,
    private val coachProfileRepository: CoachProfileRepository,
    private val courseRatingRepository: CourseRatingRepository
) {

    @Transactional(readOnly = true)
    fun getSchedule(filter: ScheduleFilter, pageable: Pageable): Page<ScheduleItem> {
        val coursePage = courseRepository.findSchedule(filter, pageable)
        val courses = coursePage.content
        if (courses.isEmpty()) {
            return PageImpl(emptyList(), pageable, coursePage.totalElements)
        }
        val now = OffsetDateTime.now()
        val occurrences = courseOccurrenceRepository.findUpcomingOccurrences(courses, now)
        val occurrencesByCourse = occurrences
            .groupBy { it.course.id!! }
            .mapValues { entry -> entry.value.sortedBy { it.startsAt }.take(MAX_OCCURRENCES_PER_COURSE) }

        val coachProfiles = coachProfileRepository.findByUserIn(courses.map { it.coach })
            .associateBy { it.user.id }

        // Get ratings for all courses
        val courseIds = courses.mapNotNull { it.id }
        val ratingsMap = courseIds.associateWith { courseId ->
            val avg = courseRatingRepository.getAverageRatingByCourseId(courseId)
            val count = courseRatingRepository.countByCourseId(courseId)
            avg to count
        }

        val items = courses.map { course ->
            val courseId = course.id ?: throw IllegalStateException("Course ${'$'}{course.name} has no id")
            val upcomingOccurrences = occurrencesByCourse[courseId].orEmpty()
            val durationMinutes = upcomingOccurrences.firstOrNull()?.let { occurrence ->
                val minutes = Duration.between(occurrence.startsAt, occurrence.endsAt).toMinutes()
                if (minutes > 0) minutes.toInt() else null
            }
            val coach = course.coach
            val profile = coachProfiles[coach.id]
            val location = course.location
            val heroPhotoUrl = if (course.heroPhoto != null) {
                "/api/public/courses/$courseId/hero-photo"
            } else null
            val sport = course.sport
            val (avgRating, ratingCount) = ratingsMap[courseId] ?: (0.0 to 0L)
            ScheduleItem(
                course = PublicCourseDto(
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
                    price = course.price,
                    pricePerSession = course.pricePerSession,
                    currency = course.currency,
                    packageOptions = course.packageOptions,
                    active = course.active,
                    durationMinutes = durationMinutes,
                    description = course.description,
                    heroPhotoUrl = heroPhotoUrl,
                    averageRating = avgRating,
                    totalRatings = ratingCount
                ),
                coach = PublicCoachDto(
                    id = coach.id!!,
                    name = coach.name,
                    avatarUrl = resolveAvatarUrl(coach.id!!, profile)
                ),
                location = PublicLocationDto(
                    id = location.id!!,
                    name = location.name,
                    lat = location.lat,
                    lng = location.lng
                ),
                nextOccurrences = upcomingOccurrences.map { it.startsAt }
            )
        }

        return PageImpl(items, pageable, coursePage.totalElements)
    }

    private fun resolveAvatarUrl(coachId: UUID, profile: com.club.triathlon.domain.CoachProfile?): String? {
        // If avatarUrl is set and not empty, use it (external URL)
        profile?.avatarUrl?.takeIf { it.isNotBlank() }?.let { return it }
        
        // If photo is stored in database, return endpoint URL
        if (profile?.photo != null) {
            return "/api/public/coaches/$coachId/photo"
        }
        
        return null
    }

    companion object {
        private const val MAX_OCCURRENCES_PER_COURSE = 7
    }
}

data class ScheduleItem(
    val course: PublicCourseDto,
    val coach: PublicCoachDto,
    val location: PublicLocationDto,
    val nextOccurrences: List<OffsetDateTime>
)

data class PublicCourseDto(
    val id: UUID,
    val name: String,
    val sport: PublicSportDto,
    val level: String?,
    val ageFrom: Int?,
    val ageTo: Int?,
    val capacity: Int?,
    val price: Long,
    val pricePerSession: Long,
    val currency: String,
    val packageOptions: String?,
    val active: Boolean,
    val durationMinutes: Int?,
    val description: String?,
    val heroPhotoUrl: String?,
    val averageRating: Double = 0.0,
    val totalRatings: Long = 0
)

data class PublicCoachDto(
    val id: UUID,
    val name: String,
    val avatarUrl: String?
)

data class PublicLocationDto(
    val id: UUID,
    val name: String,
    val lat: Double?,
    val lng: Double?
)

data class PublicSportDto(
    val id: UUID,
    val code: String,
    val name: String
)
