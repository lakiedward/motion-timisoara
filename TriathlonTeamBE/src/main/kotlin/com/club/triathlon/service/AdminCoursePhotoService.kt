package com.club.triathlon.service

import com.club.triathlon.domain.CoursePhoto
import com.club.triathlon.repo.CoursePhotoRepository
import com.club.triathlon.repo.CourseRepository
import com.club.triathlon.service.storage.StorageService
import com.club.triathlon.util.PhotoUtils
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.http.HttpHeaders
import org.springframework.http.HttpStatus
import org.springframework.http.MediaType
import org.springframework.http.ResponseEntity
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.server.ResponseStatusException
import java.net.URI
import java.time.OffsetDateTime
import java.util.UUID

@Service
class AdminCoursePhotoService(
    private val courseRepository: CourseRepository,
    private val coursePhotoRepository: CoursePhotoRepository
) {

    @Autowired(required = false)
    private var storageService: StorageService? = null

    @Transactional
    fun uploadPhoto(courseId: UUID, base64Photo: String): CoursePhotoDto {
        val course = courseRepository.findById(courseId).orElseThrow {
            ResponseStatusException(HttpStatus.NOT_FOUND, "Course not found")
        }

        val photoData = PhotoUtils.processPhoto(base64Photo)

        // Get next display order
        val maxOrder = coursePhotoRepository.findByCourseOrderByDisplayOrder(course)
            .maxOfOrNull { it.displayOrder } ?: -1

        val coursePhoto = CoursePhoto().apply {
            this.course = course
            this.photoContentType = photoData.second
            this.displayOrder = maxOrder + 1
            this.createdAt = OffsetDateTime.now()
            this.updatedAt = OffsetDateTime.now()
        }

        // Save first to get ID, then upload to S3
        val saved = coursePhotoRepository.save(coursePhoto)

        storageService?.let { storage ->
            val key = storage.generateObjectKey("courses/$courseId/gallery", photoData.second)
            storage.upload(key, photoData.first, photoData.second)
            saved.photoS3Key = key
            coursePhotoRepository.save(saved)
        } ?: run {
            saved.photo = photoData.first
            coursePhotoRepository.save(saved)
        }

        return CoursePhotoDto(
            id = saved.id!!,
            displayOrder = saved.displayOrder
        )
    }

    @Transactional(readOnly = true)
    fun getPhotos(courseId: UUID): List<CoursePhotoDto> {
        val course = courseRepository.findById(courseId).orElseThrow {
            ResponseStatusException(HttpStatus.NOT_FOUND, "Course not found")
        }

        return coursePhotoRepository.findByCourseOrderByDisplayOrder(course).map {
            CoursePhotoDto(
                id = it.id!!,
                displayOrder = it.displayOrder,
                url = it.photoS3Key?.let { key -> storageService?.generatePresignedUrl(key) }
            )
        }
    }

    @Transactional(readOnly = true)
    fun getPhoto(courseId: UUID, photoId: UUID): ResponseEntity<ByteArray> {
        val course = courseRepository.findById(courseId).orElseThrow {
            ResponseStatusException(HttpStatus.NOT_FOUND, "Course not found")
        }

        val photo = coursePhotoRepository.findById(photoId).orElseThrow {
            ResponseStatusException(HttpStatus.NOT_FOUND, "Photo not found")
        }

        if (photo.course.id != course.id) {
            throw ResponseStatusException(HttpStatus.NOT_FOUND, "Photo does not belong to this course")
        }

        // If S3 key exists, redirect to presigned URL
        photo.photoS3Key?.let { key ->
            storageService?.let { storage ->
                val presignedUrl = storage.generatePresignedUrl(key)
                return ResponseEntity.status(HttpStatus.FOUND)
                    .location(URI.create(presignedUrl))
                    .build()
            }
        }

        // Fallback to BYTEA
        val contentType = MediaType.parseMediaType(photo.photoContentType)
        return ResponseEntity.ok()
            .contentType(contentType)
            .body(photo.photo)
    }

    @Transactional
    fun deletePhoto(courseId: UUID, photoId: UUID) {
        val course = courseRepository.findById(courseId).orElseThrow {
            ResponseStatusException(HttpStatus.NOT_FOUND, "Course not found")
        }

        val photo = coursePhotoRepository.findById(photoId).orElseThrow {
            ResponseStatusException(HttpStatus.NOT_FOUND, "Photo not found")
        }

        if (photo.course.id != course.id) {
            throw ResponseStatusException(HttpStatus.NOT_FOUND, "Photo does not belong to this course")
        }

        // Delete from S3 if applicable
        photo.photoS3Key?.let { key ->
            storageService?.delete(key)
        }

        coursePhotoRepository.delete(photo)

        // Reorder remaining photos
        val remainingPhotos = coursePhotoRepository.findByCourseOrderByDisplayOrder(course)
        remainingPhotos.forEachIndexed { index, p ->
            p.displayOrder = index
            p.updatedAt = OffsetDateTime.now()
        }
        coursePhotoRepository.saveAll(remainingPhotos)
    }

    @Transactional
    fun reorderPhotos(courseId: UUID, photoIds: List<UUID>) {
        val course = courseRepository.findById(courseId).orElseThrow {
            ResponseStatusException(HttpStatus.NOT_FOUND, "Course not found")
        }

        val photos = coursePhotoRepository.findByCourseOrderByDisplayOrder(course)
        val photoMap = photos.associateBy { it.id!! }

        // Validate all photo IDs belong to this course
        photoIds.forEach { photoId ->
            if (!photoMap.containsKey(photoId)) {
                throw ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Photo with ID $photoId does not belong to this course"
                )
            }
        }

        // Reorder photos
        photoIds.forEachIndexed { index, photoId ->
            val photo = photoMap[photoId]!!
            photo.displayOrder = index
            photo.updatedAt = OffsetDateTime.now()
        }

        coursePhotoRepository.saveAll(photoMap.values)
    }
}

data class CoursePhotoDto(
    val id: UUID,
    val displayOrder: Int,
    val url: String? = null
)

