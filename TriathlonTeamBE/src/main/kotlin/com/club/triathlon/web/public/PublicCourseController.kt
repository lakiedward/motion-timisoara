package com.club.triathlon.web.public

import com.club.triathlon.repo.CoursePhotoRepository
import com.club.triathlon.repo.CourseRepository
import com.club.triathlon.service.public.PublicCourseDetailDto
import com.club.triathlon.service.public.PublicCourseService
import org.slf4j.LoggerFactory
import org.springframework.http.HttpStatus
import org.springframework.http.MediaType
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController
import org.springframework.web.server.ResponseStatusException
import java.util.UUID

@RestController
@RequestMapping("/api/public/courses")
class PublicCourseController(
    private val courseRepository: CourseRepository,
    private val coursePhotoRepository: CoursePhotoRepository,
    private val publicCourseService: PublicCourseService
) {
    
    private val logger = LoggerFactory.getLogger(PublicCourseController::class.java)

    @GetMapping("/{courseId}")
    fun getCourseDetail(@PathVariable courseId: UUID): PublicCourseDetailDto {
        logger.info("🎯 [ENDPOINT] GET PublicCourseController.getCourseDetail() - Starting execution")
        return publicCourseService.getCourseDetail(courseId)
    }

    @GetMapping("/{courseId}/hero-photo")
    fun getCourseHeroPhoto(@PathVariable courseId: UUID): ResponseEntity<ByteArray> {
        val course = courseRepository.findById(courseId).orElseThrow {
            ResponseStatusException(HttpStatus.NOT_FOUND, "Course not found")
        }

        if (!course.active) {
            throw ResponseStatusException(HttpStatus.NOT_FOUND, "Course not found")
        }

        if (course.heroPhoto == null) {
            throw ResponseStatusException(HttpStatus.NOT_FOUND, "Course has no hero photo")
        }

        val contentType = course.heroPhotoContentType?.let { MediaType.parseMediaType(it) }
            ?: MediaType.IMAGE_JPEG

        return ResponseEntity.ok()
            .contentType(contentType)
            .body(course.heroPhoto)
    }

    @GetMapping("/{courseId}/photos")
    fun getCoursePhotos(@PathVariable courseId: UUID): List<CoursePhotoSummaryDto> {
        logger.info("📷 [PUBLIC] Getting course photos for ID: $courseId")
        val photos = publicCourseService.getCoursePhotos(courseId)
        logger.info("📷 [PUBLIC] Returning ${photos.size} photos for course: $courseId")
        return photos
    }

    @GetMapping("/{courseId}/photos/{photoId}")
    fun getCoursePhoto(
        @PathVariable courseId: UUID,
        @PathVariable photoId: UUID
    ): ResponseEntity<ByteArray> {
        val course = courseRepository.findById(courseId).orElseThrow {
            ResponseStatusException(HttpStatus.NOT_FOUND, "Course not found")
        }

        if (!course.active) {
            throw ResponseStatusException(HttpStatus.NOT_FOUND, "Course not found")
        }

        val photo = coursePhotoRepository.findById(photoId).orElseThrow {
            ResponseStatusException(HttpStatus.NOT_FOUND, "Photo not found")
        }

        if (photo.course.id != course.id) {
            throw ResponseStatusException(HttpStatus.NOT_FOUND, "Photo does not belong to this course")
        }

        val contentType = MediaType.parseMediaType(photo.photoContentType)

        return ResponseEntity.ok()
            .contentType(contentType)
            .body(photo.photo)
    }
}

data class CoursePhotoSummaryDto(
    val id: UUID,
    val displayOrder: Int
)

