package com.club.triathlon.service.announcement

import com.club.triathlon.domain.Course
import com.club.triathlon.domain.CourseAnnouncement
import com.club.triathlon.domain.CourseAnnouncementAttachment
import com.club.triathlon.domain.User
import com.club.triathlon.enums.AnnouncementAttachmentType
import com.club.triathlon.enums.EnrollmentKind
import com.club.triathlon.enums.EnrollmentStatus
import com.club.triathlon.enums.Role
import com.club.triathlon.repo.CourseAnnouncementAttachmentRepository
import com.club.triathlon.repo.CourseAnnouncementRepository
import com.club.triathlon.repo.CourseRepository
import com.club.triathlon.repo.EnrollmentRepository
import com.club.triathlon.service.storage.StorageService
import com.club.triathlon.util.PhotoUtils
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.web.multipart.MultipartFile
import org.springframework.data.domain.PageRequest
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
class AnnouncementService(
    private val courseRepository: CourseRepository,
    private val announcementRepository: CourseAnnouncementRepository,
    private val attachmentRepository: CourseAnnouncementAttachmentRepository,
    private val enrollmentRepository: EnrollmentRepository
) {

    @Autowired(required = false)
    private var storageService: StorageService? = null

    // ---------------- Create ----------------
    @Transactional
    fun createAnnouncement(courseId: UUID, cmd: CreateAnnouncementCmd, author: User): AnnouncementDto {
        val course = ensureCourse(courseId)
        ensureCanManage(author, course)

        val content = cmd.content.trim()
        val images = cmd.images ?: emptyList()
        val videoUrls = cmd.videoUrls ?: emptyList()
        val videoFiles = cmd.videoFiles ?: emptyList()
        if (content.isBlank() && images.isEmpty() && videoUrls.isEmpty() && videoFiles.isEmpty()) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Content or at least one attachment is required")
        }
        if (images.size > MAX_IMAGES) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Max $MAX_IMAGES images allowed")
        }
        if (videoUrls.size + videoFiles.size > MAX_VIDEOS) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Max $MAX_VIDEOS videos allowed")
        }

        val announcement = CourseAnnouncement().apply {
            this.course = course
            this.author = author
            this.content = content
            this.pinned = cmd.pinAfterPost ?: false
            this.createdAt = OffsetDateTime.now()
        }
        val saved = announcementRepository.save(announcement)

        // Save images
        images.forEachIndexed { index, base64 ->
            val (bytes, contentType) = PhotoUtils.processPhoto(base64)
            val att = CourseAnnouncementAttachment().apply {
                this.announcement = saved
                this.type = AnnouncementAttachmentType.IMAGE
                this.displayOrder = index
                this.imageContentType = contentType
                this.createdAt = OffsetDateTime.now()
            }
            val savedAtt = attachmentRepository.save(att)
            storageService?.let { storage ->
                val key = storage.generateObjectKey("announcements/${saved.id}/images", contentType)
                storage.upload(key, bytes, contentType)
                savedAtt.imageS3Key = key
                attachmentRepository.save(savedAtt)
            } ?: run {
                savedAtt.image = bytes
                attachmentRepository.save(savedAtt)
            }
        }

        // Save video files
        videoFiles.forEachIndexed { index, file ->
            if (file.isEmpty) {
                return@forEachIndexed
            }
            val bytes = file.bytes
            if (bytes.size > MAX_VIDEO_BYTES) {
                throw ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Video file too large. Max ${MAX_VIDEO_BYTES / 1024 / 1024}MB per file"
                )
            }
            val contentType = detectVideoContentType(bytes)
                ?: throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid or unsupported video format")
            val att = CourseAnnouncementAttachment().apply {
                this.announcement = saved
                this.type = AnnouncementAttachmentType.VIDEO_FILE
                this.displayOrder = images.size + index
                this.videoContentType = contentType
                this.createdAt = OffsetDateTime.now()
            }
            val savedAtt = attachmentRepository.save(att)
            storageService?.let { storage ->
                val key = storage.generateObjectKey("announcements/${saved.id}/videos", contentType)
                storage.upload(key, bytes, contentType)
                savedAtt.videoS3Key = key
                attachmentRepository.save(savedAtt)
            } ?: run {
                savedAtt.video = bytes
                attachmentRepository.save(savedAtt)
            }
        }

        // Save video links
        videoUrls.forEachIndexed { index, url ->
            val cleaned = url.trim()
            if (!isValidUrl(cleaned)) {
                throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid video URL: $cleaned")
            }
            val att = CourseAnnouncementAttachment().apply {
                this.announcement = saved
                this.type = AnnouncementAttachmentType.VIDEO_LINK
                this.displayOrder = images.size + videoFiles.size + index
                this.url = cleaned
                this.createdAt = OffsetDateTime.now()
            }
            attachmentRepository.save(att)
        }

        return toDto(saved, includeCourse = false)
    }

    // ---------------- Pin/Unpin ----------------
    @Transactional
    fun setPinned(courseId: UUID, announcementId: UUID, pinned: Boolean, user: User) {
        val course = ensureCourse(courseId)
        ensureCanManage(user, course)
        val ann = announcementRepository.findById(announcementId).orElseThrow {
            ResponseStatusException(HttpStatus.NOT_FOUND, "Announcement not found")
        }
        if (ann.course.id != course.id) {
            throw ResponseStatusException(HttpStatus.NOT_FOUND, "Announcement not found")
        }
        ann.pinned = pinned
        announcementRepository.save(ann)
    }

    // ---------------- Delete ----------------
    @Transactional
    fun deleteAnnouncement(courseId: UUID, announcementId: UUID, user: User) {
        val course = ensureCourse(courseId)
        ensureCanManage(user, course)
        val ann = announcementRepository.findById(announcementId).orElseThrow {
            ResponseStatusException(HttpStatus.NOT_FOUND, "Announcement not found")
        }
        if (ann.course.id != course.id) {
            throw ResponseStatusException(HttpStatus.NOT_FOUND, "Announcement not found")
        }
        // Delete S3 objects for attachments, then delete from DB
        val attachments = attachmentRepository.findByAnnouncementOrderByDisplayOrder(ann)
        val s3Keys = attachments.mapNotNull { it.imageS3Key } + attachments.mapNotNull { it.videoS3Key }
        if (s3Keys.isNotEmpty()) {
            storageService?.deleteAll(s3Keys)
        }
        attachments.forEach { attachmentRepository.delete(it) }
        announcementRepository.delete(ann)
    }

    // ---------------- List (Coach/Admin) ----------------
    @Transactional(readOnly = true)
    fun listForCoach(courseId: UUID, user: User): List<AnnouncementDto> {
        val course = ensureCourse(courseId)
        ensureCanManage(user, course)
        return announcementRepository.findByCourseIdOrdered(courseId).map { toDto(it, includeCourse = false) }
    }

    // ---------------- List (Parent) ----------------
    @Transactional(readOnly = true)
    fun listForParent(courseId: UUID, parent: User): List<AnnouncementDto> {
        ensureParentCanViewCourse(parent, courseId)
        return announcementRepository.findByCourseIdOrdered(courseId).map { toDto(it, includeCourse = false) }
    }

    // ---------------- Aggregator (Parent) ----------------
    @Transactional(readOnly = true)
    fun listParentFeed(parent: User, courseId: UUID?, limit: Int): List<AnnouncementDto> {
        val courseIds = if (courseId != null) {
            ensureParentCanViewCourse(parent, courseId)
            listOf(courseId)
        } else {
            parentCourseIds(parent)
        }
        if (courseIds.isEmpty()) return emptyList()
        val pageable = PageRequest.of(0, limit.coerceIn(1, 50))
        return announcementRepository.findByCourseIdsOrdered(courseIds, pageable).map { toDto(it, includeCourse = true) }
    }

    // ---------------- Get Image ----------------
    @Transactional(readOnly = true)
    fun getImage(courseId: UUID, announcementId: UUID, imageId: UUID, user: User): ResponseEntity<ByteArray> {
        val course = ensureCourse(courseId)
        // Permissions: coach/admin for own course, or parent enrolled
        if (user.role == Role.PARENT) {
            ensureParentCanViewCourse(user, courseId)
        } else {
            ensureCanManage(user, course)
        }
        val ann = announcementRepository.findById(announcementId).orElseThrow {
            ResponseStatusException(HttpStatus.NOT_FOUND, "Announcement not found")
        }
        if (ann.course.id != course.id) {
            throw ResponseStatusException(HttpStatus.NOT_FOUND, "Announcement not found")
        }
        val att = attachmentRepository.findById(imageId).orElseThrow {
            ResponseStatusException(HttpStatus.NOT_FOUND, "Image not found")
        }
        if (att.announcement.id != ann.id || att.type != AnnouncementAttachmentType.IMAGE) {
            throw ResponseStatusException(HttpStatus.NOT_FOUND, "Image not found")
        }
        // If S3 key exists, redirect
        att.imageS3Key?.let { key ->
            storageService?.let { storage ->
                val presignedUrl = storage.generatePresignedUrl(key)
                return ResponseEntity.status(HttpStatus.FOUND)
                    .location(URI.create(presignedUrl))
                    .build()
            }
        }
        if (att.image == null) {
            throw ResponseStatusException(HttpStatus.NOT_FOUND, "Image not found")
        }
        val contentType = MediaType.parseMediaType(att.imageContentType ?: "image/jpeg")
        return ResponseEntity.ok().contentType(contentType).body(att.image)
    }

    // ---------------- Get Video ----------------
    @Transactional(readOnly = true)
    fun getVideo(courseId: UUID, announcementId: UUID, videoId: UUID, user: User): ResponseEntity<ByteArray> {
        val course = ensureCourse(courseId)
        if (user.role == Role.PARENT) {
            ensureParentCanViewCourse(user, courseId)
        } else {
            ensureCanManage(user, course)
        }
        val ann = announcementRepository.findById(announcementId).orElseThrow {
            ResponseStatusException(HttpStatus.NOT_FOUND, "Announcement not found")
        }
        if (ann.course.id != course.id) {
            throw ResponseStatusException(HttpStatus.NOT_FOUND, "Announcement not found")
        }
        val att = attachmentRepository.findById(videoId).orElseThrow {
            ResponseStatusException(HttpStatus.NOT_FOUND, "Video not found")
        }
        if (att.announcement.id != ann.id || att.type != AnnouncementAttachmentType.VIDEO_FILE) {
            throw ResponseStatusException(HttpStatus.NOT_FOUND, "Video not found")
        }
        // If S3 key exists, redirect
        att.videoS3Key?.let { key ->
            storageService?.let { storage ->
                val presignedUrl = storage.generatePresignedUrl(key)
                return ResponseEntity.status(HttpStatus.FOUND)
                    .location(URI.create(presignedUrl))
                    .build()
            }
        }
        if (att.video == null) {
            throw ResponseStatusException(HttpStatus.NOT_FOUND, "Video not found")
        }
        val contentType = MediaType.parseMediaType(att.videoContentType ?: "video/mp4")
        return ResponseEntity.ok()
            .contentType(contentType)
            .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"announcement-video.${contentType.subtype}\"")
            .body(att.video)
    }

    // ---------------- Helpers ----------------
    private fun ensureCourse(courseId: UUID): Course =
        courseRepository.findById(courseId).orElseThrow {
            ResponseStatusException(HttpStatus.NOT_FOUND, "Course not found")
        }

    private fun ensureCanManage(user: User, course: Course) {
        if (user.role == Role.ADMIN) return
        if (user.role == Role.COACH && course.coach.id == user.id) return
        throw ResponseStatusException(HttpStatus.FORBIDDEN, "Not allowed")
    }

    private fun ensureParentCanViewCourse(parent: User, courseId: UUID) {
        if (parent.role != Role.PARENT) {
            throw ResponseStatusException(HttpStatus.FORBIDDEN, "Only parents can view this feed")
        }
        val enrollments = enrollmentRepository.findByParent(parent)
        val allowed = enrollments.any {
            it.kind == EnrollmentKind.COURSE && it.entityId == courseId && (it.status == EnrollmentStatus.ACTIVE || it.status == EnrollmentStatus.PENDING)
        }
        if (!allowed) throw ResponseStatusException(HttpStatus.FORBIDDEN, "Not enrolled for this course")
    }

    private fun parentCourseIds(parent: User): List<UUID> {
        val enrollments = enrollmentRepository.findByParent(parent)
        return enrollments.filter { it.kind == EnrollmentKind.COURSE && (it.status == EnrollmentStatus.ACTIVE || it.status == EnrollmentStatus.PENDING) }
            .map { it.entityId }
            .distinct()
    }

    private fun toDto(entity: CourseAnnouncement, includeCourse: Boolean): AnnouncementDto {
        val attachments = attachmentRepository.findByAnnouncementOrderByDisplayOrder(entity).map {
            when (it.type) {
                AnnouncementAttachmentType.IMAGE -> AttachmentDto(
                    id = it.id!!,
                    type = it.type.name,
                    displayOrder = it.displayOrder,
                    image = true,
                    url = null
                )
                AnnouncementAttachmentType.VIDEO_LINK -> AttachmentDto(
                    id = it.id!!,
                    type = it.type.name,
                    displayOrder = it.displayOrder,
                    image = false,
                    url = it.url
                )
                AnnouncementAttachmentType.VIDEO_FILE -> AttachmentDto(
                    id = it.id!!,
                    type = it.type.name,
                    displayOrder = it.displayOrder,
                    image = false,
                    url = null
                )
            }
        }
        return if (includeCourse) {
            AnnouncementDto(
                id = entity.id!!,
                courseId = entity.course.id!!,
                courseName = entity.course.name,
                content = entity.content,
                pinned = entity.pinned,
                createdAt = entity.createdAt,
                authorName = entity.author.name,
                authorRole = entity.author.role.name,
                attachments = attachments
            )
        } else {
            AnnouncementDto(
                id = entity.id!!,
                courseId = null,
                courseName = null,
                content = entity.content,
                pinned = entity.pinned,
                createdAt = entity.createdAt,
                authorName = entity.author.name,
                authorRole = entity.author.role.name,
                attachments = attachments
            )
        }
    }

    private fun isValidUrl(url: String): Boolean {
        return url.startsWith("http://") || url.startsWith("https://")
    }

    private fun detectVideoContentType(bytes: ByteArray): String? {
        // Minimal signature checks for common formats
        if (bytes.size >= 12) {
            // MP4/QuickTime: ftyp
            val signature = String(bytes.sliceArray(4..7))
            if (signature == "ftyp") return "video/mp4"
        }
        if (bytes.size >= 4) {
            // WebM/Matroska
            if (bytes[0] == 0x1A.toByte() && bytes[1] == 0x45.toByte() && bytes[2] == 0xDF.toByte() && bytes[3] == 0xA3.toByte()) {
                return "video/webm"
            }
            // Ogg
            if (bytes[0] == 0x4F.toByte() && bytes[1] == 0x67.toByte() && bytes[2] == 0x67.toByte() && bytes[3] == 0x53.toByte()) {
                return "video/ogg"
            }
        }
        return null
    }

    companion object {
        private const val MAX_IMAGES = 10
        private const val MAX_VIDEOS = 2
        private const val MAX_VIDEO_BYTES = 150 * 1024 * 1024
    }
}

// ---------------- DTOs & Commands ----------------
data class AttachmentDto(
    val id: UUID,
    val type: String,
    val displayOrder: Int,
    val image: Boolean,
    val url: String?
)

data class AnnouncementDto(
    val id: UUID,
    val courseId: UUID?,
    val courseName: String?,
    val content: String,
    val pinned: Boolean,
    val createdAt: OffsetDateTime,
    val authorName: String,
    val authorRole: String,
    val attachments: List<AttachmentDto>
)

data class CreateAnnouncementCmd(
    val content: String,
    val images: List<String>?,
    val videoUrls: List<String>?,
    val pinAfterPost: Boolean?,
    val videoFiles: List<MultipartFile>?
)
