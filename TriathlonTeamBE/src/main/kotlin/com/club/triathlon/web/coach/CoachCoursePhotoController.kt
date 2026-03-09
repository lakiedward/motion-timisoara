package com.club.triathlon.web.coach

import com.club.triathlon.enums.Role
import com.club.triathlon.repo.CoursePhotoRepository
import com.club.triathlon.repo.CourseRepository
import com.club.triathlon.security.UserPrincipal
import com.club.triathlon.service.CoursePhotoDto
import com.club.triathlon.util.PhotoUtils
import jakarta.validation.Valid
import jakarta.validation.constraints.NotBlank
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.security.access.prepost.PreAuthorize
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.RestController
import org.springframework.web.server.ResponseStatusException
import java.util.UUID

@RestController
@RequestMapping("/api/coach/courses/{courseId}/photos")
@PreAuthorize("hasAnyRole('COACH','ADMIN')")
class CoachCoursePhotoController(
    private val courseRepository: CourseRepository,
    private val coursePhotoRepository: CoursePhotoRepository
) {

    private fun ensureOwnership(@AuthenticationPrincipal principal: UserPrincipal, courseId: UUID) {
        val user = principal.user
        val course = courseRepository.findById(courseId).orElseThrow {
            ResponseStatusException(HttpStatus.NOT_FOUND, "Course not found")
        }
        if (user.role != Role.ADMIN && course.coach.id != user.id) {
            throw ResponseStatusException(HttpStatus.FORBIDDEN, "Cannot modify this course")
        }
    }

    // Hero photo fetch for coach
    @GetMapping("/../hero-photo")
    fun getHeroPhoto(
        @AuthenticationPrincipal principal: UserPrincipal,
        @PathVariable courseId: UUID
    ): ResponseEntity<ByteArray> {
        ensureOwnership(principal, courseId)
        val course = courseRepository.findById(courseId).orElseThrow {
            ResponseStatusException(HttpStatus.NOT_FOUND, "Course not found")
        }
        if (course.heroPhoto == null) {
            throw ResponseStatusException(HttpStatus.NOT_FOUND, "Course has no hero photo")
        }
        val contentType = org.springframework.http.MediaType.parseMediaType(course.heroPhotoContentType ?: "image/jpeg")
        return ResponseEntity.ok().contentType(contentType).body(course.heroPhoto)
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    fun uploadPhoto(
        @AuthenticationPrincipal principal: UserPrincipal,
        @PathVariable courseId: UUID,
        @Valid @RequestBody request: UploadPhotoRequest
    ): CoursePhotoDto {
        ensureOwnership(principal, courseId)
        val (bytes, contentType) = PhotoUtils.processPhoto(request.photo)
        val course = courseRepository.findById(courseId).orElseThrow {
            ResponseStatusException(HttpStatus.NOT_FOUND, "Course not found")
        }
        val entity = com.club.triathlon.domain.CoursePhoto().apply {
            this.course = course
            this.photo = bytes
            this.photoContentType = contentType
        }
        val saved = coursePhotoRepository.save(entity)
        return CoursePhotoDto(saved.id!!, saved.displayOrder ?: 0)
    }

    @GetMapping
    fun getPhotos(
        @AuthenticationPrincipal principal: UserPrincipal,
        @PathVariable courseId: UUID
    ): List<CoursePhotoDto> {
        ensureOwnership(principal, courseId)
        val course = courseRepository.findById(courseId).orElseThrow {
            ResponseStatusException(HttpStatus.NOT_FOUND, "Course not found")
        }
        return coursePhotoRepository.findByCourseOrderByDisplayOrder(course).map {
            CoursePhotoDto(it.id!!, it.displayOrder)
        }
    }

    @GetMapping("/{photoId}")
    fun getPhoto(
        @AuthenticationPrincipal principal: UserPrincipal,
        @PathVariable courseId: UUID,
        @PathVariable photoId: UUID
    ): ResponseEntity<ByteArray> {
        ensureOwnership(principal, courseId)
        val photo = coursePhotoRepository.findById(photoId).orElseThrow {
            ResponseStatusException(HttpStatus.NOT_FOUND, "Photo not found")
        }
        if (photo.course.id != courseId) {
            throw ResponseStatusException(HttpStatus.NOT_FOUND, "Photo not found")
        }
        val contentType = org.springframework.http.MediaType.parseMediaType(photo.photoContentType)
        return ResponseEntity.ok().contentType(contentType).body(photo.photo)
    }

    @DeleteMapping("/{photoId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun deletePhoto(
        @AuthenticationPrincipal principal: UserPrincipal,
        @PathVariable courseId: UUID,
        @PathVariable photoId: UUID
    ) {
        ensureOwnership(principal, courseId)
        val photo = coursePhotoRepository.findById(photoId).orElseThrow {
            ResponseStatusException(HttpStatus.NOT_FOUND, "Photo not found")
        }
        if (photo.course.id != courseId) {
            throw ResponseStatusException(HttpStatus.NOT_FOUND, "Photo not found")
        }
        coursePhotoRepository.delete(photo)
    }
}

data class UploadPhotoRequest(
    @field:NotBlank
    val photo: String
)


