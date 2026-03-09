package com.club.triathlon.service.public

import com.club.triathlon.domain.CoachProfile
import com.club.triathlon.domain.Course
import com.club.triathlon.enums.Role
import com.club.triathlon.repo.ClubRepository
import com.club.triathlon.repo.CoachProfileRepository
import com.club.triathlon.repo.CoachRatingRepository
import com.club.triathlon.repo.CourseRepository
import com.club.triathlon.repo.UserRepository
import com.club.triathlon.service.storage.StorageService
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.http.HttpStatus
import org.springframework.http.MediaType
import org.springframework.http.ResponseEntity
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.server.ResponseStatusException
import java.net.URI
import java.util.Locale
import java.util.UUID

@Service
class PublicCoachService(
    private val userRepository: UserRepository,
    private val coachProfileRepository: CoachProfileRepository,
    private val courseRepository: CourseRepository,
    private val coachRatingRepository: CoachRatingRepository,
    private val clubRepository: ClubRepository
) {

    @Autowired(required = false)
    private var storageService: StorageService? = null

    @Transactional(readOnly = true)
    fun listCoaches(sportId: UUID? = null, locationId: UUID? = null, clubId: UUID? = null): List<CoachSummaryDto> {
        val coaches = if (clubId != null) {
            val club = clubRepository.findById(clubId)
                .orElseThrow { ResponseStatusException(HttpStatus.NOT_FOUND, "Club not found") }

            // Hide disabled clubs from public API
            if (!club.owner.enabled) {
                throw ResponseStatusException(HttpStatus.NOT_FOUND, "Club not found")
            }

            club.coaches
                .map { it.user }
                .filter { it.enabled && it.role == Role.COACH }
                .distinctBy { it.id }
        } else {
            userRepository.findAllByRole(Role.COACH)
                .filter { it.enabled }
        }
        if (coaches.isEmpty()) {
            return emptyList()
        }

        val profilesByUserId = coachProfileRepository.findByUserIn(coaches)
            .associateBy { it.user.id }
        val coursesByCoachId = courseRepository.findByCoachIn(coaches)
            .filter { it.active }
            .groupBy { it.coach.id }

        // Get ratings for all coaches
        val coachIds = coaches.mapNotNull { it.id }
        val ratingsMap = coachIds.associateWith { coachId ->
            val avg = coachRatingRepository.getAverageRatingByCoachId(coachId)
            val count = coachRatingRepository.countByCoachId(coachId)
            avg to count
        }

        // Apply filters and build result
        return coaches
            .mapNotNull { coach ->
                val profile = profilesByUserId[coach.id]
                val activeCourses = coursesByCoachId[coach.id].orEmpty()
                
                // Check if coach matches sport filter based on profile sports (specializations)
                if (sportId != null) {
                    val coachSports = profile?.sports?.map { it.id } ?: emptyList()
                    if (sportId !in coachSports) {
                        return@mapNotNull null
                    }
                }
                
                // Apply location filtering to courses for display
                val coursesToDisplay = if (locationId != null) {
                    activeCourses.filter { course -> course.location.id == locationId }
                } else {
                    activeCourses
                }
                
                val (avgRating, ratingCount) = ratingsMap[coach.id] ?: (0.0 to 0L)
                
                CoachSummaryDto(
                    id = coach.id!!,
                    name = coach.name,
                    avatarUrl = resolveAvatarUrl(coach.id!!, profile),
                    summary = extractSummary(profile),
                    disciplines = buildDisciplines(profile, activeCourses),
                    locations = buildLocations(coursesToDisplay),
                    activeCourseCount = coursesToDisplay.size,
                    averageRating = avgRating,
                    totalRatings = ratingCount
                )
            }
            .sortedBy { it.name.lowercase(Locale.getDefault()) }
    }

    @Transactional(readOnly = true)
    fun getCoachDetail(coachId: UUID): CoachDetailDto {
        val coach = userRepository.findById(coachId).orElseThrow {
            ResponseStatusException(HttpStatus.NOT_FOUND, "Coach not found")
        }
        if (coach.role != Role.COACH || !coach.enabled) {
            throw ResponseStatusException(HttpStatus.NOT_FOUND, "Coach not found")
        }

        val profile = coachProfileRepository.findByUser(coach)
        val courses = courseRepository.findByCoach(coach)
            .filter { it.active }
            .sortedBy { it.name.lowercase(Locale.getDefault()) }

        // Get coach rating
        val avgRating = coachRatingRepository.getAverageRatingByCoachId(coachId)
        val ratingCount = coachRatingRepository.countByCoachId(coachId)

        return CoachDetailDto(
            id = coach.id!!,
            name = coach.name,
            avatarUrl = resolveAvatarUrl(coach.id!!, profile),
            biography = profile?.bio?.trim(),
            focusAreas = extractFocusAreas(profile),
            courses = courses.map { course ->
                val sport = course.sport
                CoachCourseDto(
                    id = course.id!!,
                    name = course.name,
                    sport = PublicSportDto(
                        id = sport.id!!,
                        code = sport.code,
                        name = sport.name
                    ),
                    level = course.level
                )
            },
            averageRating = avgRating,
            totalRatings = ratingCount
        )
    }

    @Transactional(readOnly = true)
    fun getCoachPhoto(coachId: UUID): ResponseEntity<ByteArray> {
        val coach = userRepository.findById(coachId).orElseThrow {
            ResponseStatusException(HttpStatus.NOT_FOUND, "Coach not found")
        }
        if (coach.role != Role.COACH || !coach.enabled) {
            throw ResponseStatusException(HttpStatus.NOT_FOUND, "Coach not found")
        }

        val profile = coachProfileRepository.findByUser(coach)
            ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "Coach profile not found")

        // If S3 key exists, redirect to presigned URL
        profile.photoS3Key?.let { key ->
            storageService?.let { storage ->
                val presignedUrl = storage.generatePresignedUrl(key)
                return ResponseEntity.status(HttpStatus.FOUND)
                    .location(URI.create(presignedUrl))
                    .build()
            }
        }

        if (profile.photo == null) {
            throw ResponseStatusException(HttpStatus.NOT_FOUND, "Coach has no photo")
        }

        val contentType = profile.photoContentType?.let { MediaType.parseMediaType(it) }
            ?: MediaType.IMAGE_JPEG

        return ResponseEntity.ok()
            .contentType(contentType)
            .body(profile.photo)
    }

    private fun extractSummary(profile: CoachProfile?): String? {
        // Try bio first
        val bio = profile?.bio?.trim()
        if (!bio.isNullOrEmpty()) {
            return bio.replace(WHITESPACE_REGEX, " ").take(MAX_SUMMARY_LENGTH)
        }
        
        // Fall back to sports if no bio
        val sportsText = profile?.sports?.joinToString(", ") { it.name }?.trim()
        if (!sportsText.isNullOrEmpty()) {
            return sportsText.replace(WHITESPACE_REGEX, " ").take(MAX_SUMMARY_LENGTH)
        }
        
        return null
    }

    private fun extractFocusAreas(profile: CoachProfile?): List<String> {
        val sports = profile?.sports ?: return emptyList()
        return sports.map { it.name }.sorted()
    }

    private fun resolveAvatarUrl(coachId: UUID, profile: CoachProfile?): String? {
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

    private fun buildDisciplines(profile: CoachProfile?, courses: List<Course>): List<CoachDisciplineSummary> {
        // Get sports from coach profile (all specializations)
        val profileSports = profile?.sports ?: emptySet()
        
        if (profileSports.isEmpty()) {
            return emptyList()
        }
        
        // Group courses by sport to get levels
        val coursesBySportId = courses
            .groupBy { it.sport.id }
            .mapValues { (_, groupedCourses) ->
                groupedCourses
                    .mapNotNull { it.level?.trim() }
                    .filter { it.isNotEmpty() }
                    .distinct()
                    .sortedWith(String.CASE_INSENSITIVE_ORDER)
            }
        
        // Build disciplines from profile sports, adding levels from courses if available
        return profileSports
            .map { sport ->
                val levels = coursesBySportId[sport.id] ?: emptyList()
                CoachDisciplineSummary(
                    sport = PublicSportDto(
                        id = sport.id!!,
                        code = sport.code,
                        name = sport.name
                    ),
                    levels = levels
                )
            }
            .sortedBy { it.sport.name.lowercase(Locale.getDefault()) }
    }

    private fun buildLocations(courses: List<Course>): List<CoachLocationSummary> {
        if (courses.isEmpty()) {
            return emptyList()
        }
        
        return courses
            .groupBy { it.location.id }
            .map { (_, groupedCourses) ->
                val location = groupedCourses.first().location
                val sports = groupedCourses
                    .map { it.sport }
                    .distinctBy { it.id }
                    .map { sport ->
                        PublicSportDto(
                            id = sport.id!!,
                            code = sport.code,
                            name = sport.name
                        )
                    }
                    .sortedBy { it.name.lowercase(Locale.getDefault()) }
                
                CoachLocationSummary(
                    id = location.id!!,
                    name = location.name,
                    sports = sports
                )
            }
            .sortedBy { it.name.lowercase(Locale.getDefault()) }
    }

    companion object {
        private const val MAX_SUMMARY_LENGTH = 200
        private val WHITESPACE_REGEX = "\\s+".toRegex()
    }
}

data class CoachSummaryDto(
    val id: UUID,
    val name: String,
    val avatarUrl: String?,
    val summary: String?,
    val disciplines: List<CoachDisciplineSummary>,
    val locations: List<CoachLocationSummary>,
    val activeCourseCount: Int,
    val averageRating: Double = 0.0,
    val totalRatings: Long = 0
)

data class CoachDisciplineSummary(
    val sport: PublicSportDto,
    val levels: List<String>
)

data class CoachLocationSummary(
    val id: UUID,
    val name: String,
    val sports: List<PublicSportDto>
)

data class CoachDetailDto(
    val id: UUID,
    val name: String,
    val avatarUrl: String?,
    val biography: String?,
    val focusAreas: List<String>,
    val courses: List<CoachCourseDto>,
    val averageRating: Double = 0.0,
    val totalRatings: Long = 0
)

data class CoachCourseDto(
    val id: UUID,
    val name: String,
    val sport: PublicSportDto,
    val level: String?
)
