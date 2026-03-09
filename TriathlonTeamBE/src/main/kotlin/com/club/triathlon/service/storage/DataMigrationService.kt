package com.club.triathlon.service.storage

import com.club.triathlon.repo.ActivityRepository
import com.club.triathlon.repo.ClubRepository
import com.club.triathlon.repo.CoachProfileRepository
import com.club.triathlon.repo.CourseAnnouncementAttachmentRepository
import com.club.triathlon.repo.CoursePhotoRepository
import com.club.triathlon.repo.CourseRepository
import com.club.triathlon.util.PhotoUtils
import org.slf4j.LoggerFactory
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import software.amazon.awssdk.services.s3.S3Client
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicInteger

data class MigrationStatus(
    val running: Boolean,
    val totalMigrated: Int,
    val totalSkipped: Int,
    val totalErrors: Int,
    val details: Map<String, Int>
)

@Service
@ConditionalOnBean(S3Client::class)
class DataMigrationService(
    private val storageService: StorageService,
    private val courseRepository: CourseRepository,
    private val coursePhotoRepository: CoursePhotoRepository,
    private val coachProfileRepository: CoachProfileRepository,
    private val clubRepository: ClubRepository,
    private val activityRepository: ActivityRepository,
    private val attachmentRepository: CourseAnnouncementAttachmentRepository
) {

    private val logger = LoggerFactory.getLogger(DataMigrationService::class.java)
    private val running = AtomicBoolean(false)
    private val migrated = AtomicInteger(0)
    private val skipped = AtomicInteger(0)
    private val errors = AtomicInteger(0)
    private val details = mutableMapOf<String, Int>()

    fun getStatus(): MigrationStatus = MigrationStatus(
        running = running.get(),
        totalMigrated = migrated.get(),
        totalSkipped = skipped.get(),
        totalErrors = errors.get(),
        details = details.toMap()
    )

    @Transactional
    fun migrateAll() {
        if (!running.compareAndSet(false, true)) {
            logger.warn("Migration already running")
            return
        }
        try {
            migrated.set(0)
            skipped.set(0)
            errors.set(0)
            details.clear()

            migrateCourseHeroPhotos()
            migrateCourseGalleryPhotos()
            migrateCoachPhotos()
            migrateClubLogos()
            migrateClubHeroPhotos()
            migrateActivityHeroPhotos()
            migrateAnnouncementImages()
            migrateAnnouncementVideos()

            logger.info("Migration complete: migrated={}, skipped={}, errors={}", migrated.get(), skipped.get(), errors.get())
        } finally {
            running.set(false)
        }
    }

    private fun migrateCourseHeroPhotos() {
        var count = 0
        courseRepository.findAll().forEach { course ->
            if (course.heroPhotoS3Key != null || course.heroPhoto == null) {
                skipped.incrementAndGet()
                return@forEach
            }
            try {
                val key = storageService.generateObjectKey(
                    "courses/${course.id}/hero",
                    course.heroPhotoContentType ?: "image/jpeg"
                )
                storageService.upload(key, course.heroPhoto!!, course.heroPhotoContentType ?: "image/jpeg")
                course.heroPhotoS3Key = key
                courseRepository.save(course)
                count++
                migrated.incrementAndGet()
            } catch (e: Exception) {
                logger.error("Failed to migrate course hero photo for course ${course.id}", e)
                errors.incrementAndGet()
            }
        }
        details["courseHeroPhotos"] = count
        logger.info("Migrated $count course hero photos")
    }

    private fun migrateCourseGalleryPhotos() {
        var count = 0
        coursePhotoRepository.findAll().forEach { photo ->
            if (photo.photoS3Key != null || !isPhotoInitialized(photo)) {
                skipped.incrementAndGet()
                return@forEach
            }
            try {
                val key = storageService.generateObjectKey(
                    "courses/${photo.course.id}/gallery",
                    photo.photoContentType
                )
                storageService.upload(key, photo.photo, photo.photoContentType)
                photo.photoS3Key = key
                coursePhotoRepository.save(photo)
                count++
                migrated.incrementAndGet()
            } catch (e: Exception) {
                logger.error("Failed to migrate course gallery photo ${photo.id}", e)
                errors.incrementAndGet()
            }
        }
        details["courseGalleryPhotos"] = count
        logger.info("Migrated $count course gallery photos")
    }

    private fun isPhotoInitialized(photo: com.club.triathlon.domain.CoursePhoto): Boolean {
        return try {
            photo.photo
            true
        } catch (e: UninitializedPropertyAccessException) {
            false
        }
    }

    private fun migrateCoachPhotos() {
        var count = 0
        coachProfileRepository.findAll().forEach { profile ->
            if (profile.photoS3Key != null || profile.photo == null) {
                skipped.incrementAndGet()
                return@forEach
            }
            try {
                val key = storageService.generateObjectKey(
                    "coaches/${profile.id}",
                    profile.photoContentType ?: "image/jpeg"
                )
                storageService.upload(key, profile.photo!!, profile.photoContentType ?: "image/jpeg")
                profile.photoS3Key = key
                coachProfileRepository.save(profile)
                count++
                migrated.incrementAndGet()
            } catch (e: Exception) {
                logger.error("Failed to migrate coach photo for profile ${profile.id}", e)
                errors.incrementAndGet()
            }
        }
        details["coachPhotos"] = count
        logger.info("Migrated $count coach photos")
    }

    private fun migrateClubLogos() {
        var count = 0
        clubRepository.findAll().forEach { club ->
            if (club.logoS3Key != null || club.logo == null) {
                skipped.incrementAndGet()
                return@forEach
            }
            try {
                val key = storageService.generateObjectKey(
                    "clubs/${club.id}/logo",
                    club.logoContentType ?: "image/jpeg"
                )
                storageService.upload(key, club.logo!!, club.logoContentType ?: "image/jpeg")
                club.logoS3Key = key
                clubRepository.save(club)
                count++
                migrated.incrementAndGet()
            } catch (e: Exception) {
                logger.error("Failed to migrate club logo for club ${club.id}", e)
                errors.incrementAndGet()
            }
        }
        details["clubLogos"] = count
        logger.info("Migrated $count club logos")
    }

    private fun migrateClubHeroPhotos() {
        var count = 0
        clubRepository.findAll().forEach { club ->
            if (club.heroPhotoS3Key != null || club.heroPhoto == null) {
                skipped.incrementAndGet()
                return@forEach
            }
            try {
                val key = storageService.generateObjectKey(
                    "clubs/${club.id}/hero",
                    club.heroPhotoContentType ?: "image/jpeg"
                )
                storageService.upload(key, club.heroPhoto!!, club.heroPhotoContentType ?: "image/jpeg")
                club.heroPhotoS3Key = key
                clubRepository.save(club)
                count++
                migrated.incrementAndGet()
            } catch (e: Exception) {
                logger.error("Failed to migrate club hero photo for club ${club.id}", e)
                errors.incrementAndGet()
            }
        }
        details["clubHeroPhotos"] = count
        logger.info("Migrated $count club hero photos")
    }

    private fun migrateActivityHeroPhotos() {
        var count = 0
        activityRepository.findAll().forEach { activity ->
            if (activity.heroPhotoS3Key != null || activity.heroPhoto.isNullOrBlank()) {
                skipped.incrementAndGet()
                return@forEach
            }
            try {
                val photoData = PhotoUtils.processPhoto(activity.heroPhoto!!)
                val key = storageService.generateObjectKey(
                    "activities/${activity.id}/hero",
                    photoData.second
                )
                storageService.upload(key, photoData.first, photoData.second)
                activity.heroPhotoS3Key = key
                activityRepository.save(activity)
                count++
                migrated.incrementAndGet()
            } catch (e: Exception) {
                logger.error("Failed to migrate activity hero photo for activity ${activity.id}", e)
                errors.incrementAndGet()
            }
        }
        details["activityHeroPhotos"] = count
        logger.info("Migrated $count activity hero photos")
    }

    private fun migrateAnnouncementImages() {
        var count = 0
        attachmentRepository.findAll().forEach { att ->
            if (att.imageS3Key != null || att.image == null) {
                skipped.incrementAndGet()
                return@forEach
            }
            try {
                val key = storageService.generateObjectKey(
                    "announcements/${att.announcement.id}/images",
                    att.imageContentType ?: "image/jpeg"
                )
                storageService.upload(key, att.image!!, att.imageContentType ?: "image/jpeg")
                att.imageS3Key = key
                attachmentRepository.save(att)
                count++
                migrated.incrementAndGet()
            } catch (e: Exception) {
                logger.error("Failed to migrate announcement image ${att.id}", e)
                errors.incrementAndGet()
            }
        }
        details["announcementImages"] = count
        logger.info("Migrated $count announcement images")
    }

    private fun migrateAnnouncementVideos() {
        var count = 0
        attachmentRepository.findAll().forEach { att ->
            if (att.videoS3Key != null || att.video == null) {
                skipped.incrementAndGet()
                return@forEach
            }
            try {
                val key = storageService.generateObjectKey(
                    "announcements/${att.announcement.id}/videos",
                    att.videoContentType ?: "video/mp4"
                )
                storageService.upload(key, att.video!!, att.videoContentType ?: "video/mp4")
                att.videoS3Key = key
                attachmentRepository.save(att)
                count++
                migrated.incrementAndGet()
            } catch (e: Exception) {
                logger.error("Failed to migrate announcement video ${att.id}", e)
                errors.incrementAndGet()
            }
        }
        details["announcementVideos"] = count
        logger.info("Migrated $count announcement videos")
    }
}
