package com.club.triathlon.web.club

import com.club.triathlon.repo.ClubRepository
import com.club.triathlon.repo.CourseRepository
import com.club.triathlon.security.UserPrincipal
import com.club.triathlon.service.AdminCoursePhotoService
import com.club.triathlon.service.CoursePhotoDto
import jakarta.validation.Valid
import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.NotEmpty
import org.springframework.http.HttpStatus
import org.springframework.security.access.prepost.PreAuthorize
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PatchMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.RestController
import org.springframework.web.server.ResponseStatusException
import java.util.UUID

@RestController
@RequestMapping("/api/club/courses/{courseId}/photos")
@PreAuthorize("hasRole('CLUB')")
class ClubCoursePhotoController(
    private val clubRepository: ClubRepository,
    private val courseRepository: CourseRepository,
    private val adminCoursePhotoService: AdminCoursePhotoService
) {

    private fun ensureClubOwnsCourse(principal: UserPrincipal, courseId: UUID) {
        val club = clubRepository.findByOwnerId(principal.user.id!!)
            ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "Club not found for this user")

        val course = courseRepository.findById(courseId).orElseThrow {
            ResponseStatusException(HttpStatus.NOT_FOUND, "Course not found")
        }

        // 404 on mismatch to avoid leaking existence across clubs
        if (course.club?.id != club.id) {
            throw ResponseStatusException(HttpStatus.NOT_FOUND, "Course not found")
        }
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    fun uploadPhoto(
        @AuthenticationPrincipal principal: UserPrincipal,
        @PathVariable courseId: UUID,
        @Valid @RequestBody request: UploadPhotoRequest
    ): CoursePhotoDto {
        ensureClubOwnsCourse(principal, courseId)
        return adminCoursePhotoService.uploadPhoto(courseId, request.photo)
    }

    @GetMapping
    fun getPhotos(
        @AuthenticationPrincipal principal: UserPrincipal,
        @PathVariable courseId: UUID
    ): List<CoursePhotoDto> {
        ensureClubOwnsCourse(principal, courseId)
        return adminCoursePhotoService.getPhotos(courseId)
    }

    @DeleteMapping("/{photoId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun deletePhoto(
        @AuthenticationPrincipal principal: UserPrincipal,
        @PathVariable courseId: UUID,
        @PathVariable photoId: UUID
    ) {
        ensureClubOwnsCourse(principal, courseId)
        adminCoursePhotoService.deletePhoto(courseId, photoId)
    }

    @PatchMapping("/reorder")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun reorderPhotos(
        @AuthenticationPrincipal principal: UserPrincipal,
        @PathVariable courseId: UUID,
        @Valid @RequestBody request: ReorderPhotosRequest
    ) {
        ensureClubOwnsCourse(principal, courseId)
        adminCoursePhotoService.reorderPhotos(courseId, request.photoIds)
    }
}

data class UploadPhotoRequest(
    @field:NotBlank
    val photo: String
)

data class ReorderPhotosRequest(
    @field:NotEmpty
    val photoIds: List<UUID>
)


