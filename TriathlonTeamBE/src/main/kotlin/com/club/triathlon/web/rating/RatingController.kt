package com.club.triathlon.web.rating

import com.club.triathlon.security.UserPrincipal
import com.club.triathlon.service.rating.AverageRatingDto
import com.club.triathlon.service.rating.MyRatingsDto
import com.club.triathlon.service.rating.RatingRequest
import com.club.triathlon.service.rating.RatingResponse
import com.club.triathlon.service.rating.RatingService
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.security.access.prepost.PreAuthorize
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController
import java.util.UUID

@RestController
@RequestMapping("/api/ratings")
class RatingController(
    private val ratingService: RatingService
) {

    @PostMapping("/courses/{courseId}")
    @PreAuthorize("hasRole('PARENT')")
    fun rateCourse(
        @PathVariable courseId: UUID,
        @RequestBody request: RatingRequest,
        @AuthenticationPrincipal principal: UserPrincipal
    ): ResponseEntity<Any> {
        val parentId = principal.user.id ?: throw IllegalStateException("User ID is null")
        return try {
            val response = ratingService.rateCourse(parentId, courseId, request.rating, request.comment)
            ResponseEntity.ok(response)
        } catch (e: IllegalArgumentException) {
            ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(mapOf("message" to (e.message ?: "Nu poți evalua acest curs")))
        }
    }

    @PostMapping("/coaches/{coachId}")
    @PreAuthorize("hasRole('PARENT')")
    fun rateCoach(
        @PathVariable coachId: UUID,
        @RequestBody request: RatingRequest,
        @AuthenticationPrincipal principal: UserPrincipal
    ): ResponseEntity<Any> {
        val parentId = principal.user.id ?: throw IllegalStateException("User ID is null")
        return try {
            val response = ratingService.rateCoach(parentId, coachId, request.rating, request.comment)
            ResponseEntity.ok(response)
        } catch (e: IllegalArgumentException) {
            ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(mapOf("message" to (e.message ?: "Nu poți evalua acest antrenor")))
        }
    }

    @GetMapping("/courses/{courseId}/mine")
    @PreAuthorize("hasRole('PARENT')")
    fun getMyCourseRating(
        @PathVariable courseId: UUID,
        @AuthenticationPrincipal principal: UserPrincipal
    ): ResponseEntity<RatingResponse> {
        val parentId = principal.user.id ?: throw IllegalStateException("User ID is null")
        val rating = ratingService.getCourseRating(parentId, courseId)
        return if (rating != null) {
            ResponseEntity.ok(rating)
        } else {
            ResponseEntity.notFound().build()
        }
    }

    @GetMapping("/coaches/{coachId}/mine")
    @PreAuthorize("hasRole('PARENT')")
    fun getMyCoachRating(
        @PathVariable coachId: UUID,
        @AuthenticationPrincipal principal: UserPrincipal
    ): ResponseEntity<RatingResponse> {
        val parentId = principal.user.id ?: throw IllegalStateException("User ID is null")
        val rating = ratingService.getCoachRating(parentId, coachId)
        return if (rating != null) {
            ResponseEntity.ok(rating)
        } else {
            ResponseEntity.notFound().build()
        }
    }

    @GetMapping("/courses/{courseId}/average")
    fun getCourseAverageRating(@PathVariable courseId: UUID): ResponseEntity<AverageRatingDto> {
        val average = ratingService.getCourseAverageRating(courseId)
        return ResponseEntity.ok(average)
    }

    @GetMapping("/coaches/{coachId}/average")
    fun getCoachAverageRating(@PathVariable coachId: UUID): ResponseEntity<AverageRatingDto> {
        val average = ratingService.getCoachAverageRating(coachId)
        return ResponseEntity.ok(average)
    }

    @GetMapping("/mine")
    @PreAuthorize("hasRole('PARENT')")
    fun getMyRatings(@AuthenticationPrincipal principal: UserPrincipal): ResponseEntity<MyRatingsDto> {
        val parentId = principal.user.id ?: throw IllegalStateException("User ID is null")
        val ratings = ratingService.getMyRatings(parentId)
        return ResponseEntity.ok(ratings)
    }
}

