package com.club.triathlon.web.admin

import com.club.triathlon.service.AdminCoursePhotoService
import com.club.triathlon.service.CoursePhotoDto
import jakarta.validation.Valid
import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.NotEmpty
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.security.access.prepost.PreAuthorize
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PatchMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.RestController
import java.util.UUID

@RestController
@RequestMapping("/api/admin/courses/{courseId}/photos")
@PreAuthorize("hasRole('ADMIN')")
class AdminCoursePhotoController(
    private val adminCoursePhotoService: AdminCoursePhotoService
) {

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    fun uploadPhoto(
        @PathVariable courseId: UUID,
        @Valid @RequestBody request: UploadPhotoRequest
    ): CoursePhotoDto {
        return adminCoursePhotoService.uploadPhoto(courseId, request.photo)
    }

    @GetMapping
    fun getPhotos(@PathVariable courseId: UUID): List<CoursePhotoDto> {
        return adminCoursePhotoService.getPhotos(courseId)
    }

    @GetMapping("/{photoId}")
    fun getPhoto(
        @PathVariable courseId: UUID,
        @PathVariable photoId: UUID
    ): ResponseEntity<ByteArray> {
        return adminCoursePhotoService.getPhoto(courseId, photoId)
    }

    @DeleteMapping("/{photoId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun deletePhoto(
        @PathVariable courseId: UUID,
        @PathVariable photoId: UUID
    ) {
        adminCoursePhotoService.deletePhoto(courseId, photoId)
    }

    @PatchMapping("/reorder")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun reorderPhotos(
        @PathVariable courseId: UUID,
        @Valid @RequestBody request: ReorderPhotosRequest
    ) {
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

