package com.club.triathlon.service.rating

import com.club.triathlon.domain.CoachRating
import com.club.triathlon.domain.Course
import com.club.triathlon.domain.CourseRating
import com.club.triathlon.domain.User
import com.club.triathlon.enums.EnrollmentKind
import com.club.triathlon.enums.EnrollmentStatus
import com.club.triathlon.repo.CoachRatingRepository
import com.club.triathlon.repo.CourseRatingRepository
import com.club.triathlon.repo.CourseRepository
import com.club.triathlon.repo.EnrollmentRepository
import com.club.triathlon.repo.UserRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.OffsetDateTime
import java.util.UUID

@Service
class RatingService(
    private val courseRatingRepository: CourseRatingRepository,
    private val coachRatingRepository: CoachRatingRepository,
    private val enrollmentRepository: EnrollmentRepository,
    private val courseRepository: CourseRepository,
    private val userRepository: UserRepository
) {

    @Transactional
    fun rateCourse(parentId: UUID, courseId: UUID, rating: Int, comment: String?): RatingResponse {
        validateRating(rating)
        
        val parent = userRepository.findById(parentId)
            .orElseThrow { IllegalArgumentException("Părintele nu a fost găsit") }
        
        val course = courseRepository.findById(courseId)
            .orElseThrow { IllegalArgumentException("Cursul nu a fost găsit") }
        
        // Validate that parent has at least one enrolled child in this course
        if (!hasEnrollmentInCourse(parentId, courseId)) {
            throw IllegalArgumentException("Poți evalua doar cursurile la care ai copii înscriși")
        }
        
        val now = OffsetDateTime.now()
        val courseRating = courseRatingRepository.findByCourseIdAndParentId(courseId, parentId)
            .orElse(CourseRating().apply {
                this.course = course
                this.parent = parent
                this.createdAt = now
            })
        
        courseRating.rating = rating
        courseRating.comment = comment
        courseRating.updatedAt = now
        
        val saved = courseRatingRepository.save(courseRating)
        return saved.toResponse()
    }

    @Transactional
    fun rateCoach(parentId: UUID, coachId: UUID, rating: Int, comment: String?): RatingResponse {
        validateRating(rating)
        
        val parent = userRepository.findById(parentId)
            .orElseThrow { IllegalArgumentException("Părintele nu a fost găsit") }
        
        val coach = userRepository.findById(coachId)
            .orElseThrow { IllegalArgumentException("Antrenorul nu a fost găsit") }
        
        // Validate that parent has at least one enrolled child with this coach
        if (!hasEnrollmentWithCoach(parentId, coachId)) {
            throw IllegalArgumentException("Poți evalua doar antrenorii care predau copiilor tăi înscriși")
        }
        
        val now = OffsetDateTime.now()
        val coachRating = coachRatingRepository.findByCoachIdAndParentId(coachId, parentId)
            .orElse(CoachRating().apply {
                this.coach = coach
                this.parent = parent
                this.createdAt = now
            })
        
        coachRating.rating = rating
        coachRating.comment = comment
        coachRating.updatedAt = now
        
        val saved = coachRatingRepository.save(coachRating)
        return saved.toResponse()
    }

    @Transactional(readOnly = true)
    fun getCourseRating(parentId: UUID, courseId: UUID): RatingResponse? {
        return courseRatingRepository.findByCourseIdAndParentId(courseId, parentId)
            .map { it.toResponse() }
            .orElse(null)
    }

    @Transactional(readOnly = true)
    fun getCoachRating(parentId: UUID, coachId: UUID): RatingResponse? {
        return coachRatingRepository.findByCoachIdAndParentId(coachId, parentId)
            .map { it.toResponse() }
            .orElse(null)
    }

    @Transactional(readOnly = true)
    fun getCourseAverageRating(courseId: UUID): AverageRatingDto {
        val average = courseRatingRepository.getAverageRatingByCourseId(courseId)
        val count = courseRatingRepository.countByCourseId(courseId)
        return AverageRatingDto(average, count)
    }

    @Transactional(readOnly = true)
    fun getCoachAverageRating(coachId: UUID): AverageRatingDto {
        val average = coachRatingRepository.getAverageRatingByCoachId(coachId)
        val count = coachRatingRepository.countByCoachId(coachId)
        return AverageRatingDto(average, count)
    }

    @Transactional(readOnly = true)
    fun getMyRatings(parentId: UUID): MyRatingsDto {
        val courseRatings = courseRatingRepository.findAllByParentId(parentId).map { it.toResponse() }
        val coachRatings = coachRatingRepository.findAllByParentId(parentId).map { it.toResponse() }
        return MyRatingsDto(courseRatings, coachRatings)
    }

    private fun hasEnrollmentInCourse(parentId: UUID, courseId: UUID): Boolean {
        val parent = userRepository.findById(parentId)
            .orElseThrow { IllegalArgumentException("Parent not found") }
        
        val activeStatuses = listOf(EnrollmentStatus.ACTIVE, EnrollmentStatus.PENDING)
        val enrollments = enrollmentRepository.findByParent(parent)
        
        return enrollments.any { enrollment ->
            enrollment.kind == EnrollmentKind.COURSE &&
            enrollment.entityId == courseId &&
            enrollment.status in activeStatuses
        }
    }

    private fun hasEnrollmentWithCoach(parentId: UUID, coachId: UUID): Boolean {
        val parent = userRepository.findById(parentId)
            .orElseThrow { IllegalArgumentException("Parent not found") }
        
        val activeStatuses = listOf(EnrollmentStatus.ACTIVE, EnrollmentStatus.PENDING)
        val enrollments = enrollmentRepository.findByParent(parent)
        
        // Get all course enrollments
        val courseIds = enrollments
            .filter { it.kind == EnrollmentKind.COURSE && it.status in activeStatuses }
            .map { it.entityId }
            .toSet()
        
        if (courseIds.isEmpty()) return false
        
        // Check if any of these courses are taught by the coach
        val courses = courseRepository.findAllById(courseIds)
        return courses.any { it.coach.id == coachId }
    }

    private fun validateRating(rating: Int) {
        if (rating < 1 || rating > 5) {
            throw IllegalArgumentException("Ratingul trebuie să fie între 1 și 5")
        }
    }
}

// DTOs
data class RatingRequest(
    val rating: Int,
    val comment: String?
)

data class RatingResponse(
    val id: UUID,
    val rating: Int,
    val comment: String?,
    val createdAt: OffsetDateTime,
    val updatedAt: OffsetDateTime
)

data class AverageRatingDto(
    val averageRating: Double,
    val totalRatings: Long
)

data class MyRatingsDto(
    val courseRatings: List<RatingResponse>,
    val coachRatings: List<RatingResponse>
)

// Extension functions
private fun CourseRating.toResponse() = RatingResponse(
    id = this.id!!,
    rating = this.rating,
    comment = this.comment,
    createdAt = this.createdAt,
    updatedAt = this.updatedAt
)

private fun CoachRating.toResponse() = RatingResponse(
    id = this.id!!,
    rating = this.rating,
    comment = this.comment,
    createdAt = this.createdAt,
    updatedAt = this.updatedAt
)

