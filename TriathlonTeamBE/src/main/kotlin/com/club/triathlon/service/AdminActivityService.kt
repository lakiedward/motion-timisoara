package com.club.triathlon.service

import com.club.triathlon.domain.Activity
import com.club.triathlon.enums.EnrollmentKind
import com.club.triathlon.enums.EnrollmentStatus
import com.club.triathlon.repo.ActivityRepository
import com.club.triathlon.repo.EnrollmentRepository
import com.club.triathlon.repo.InvoiceRepository
import com.club.triathlon.repo.LocationRepository
import com.club.triathlon.repo.MonthlyPaymentRepository
import com.club.triathlon.repo.PaymentRepository
import com.club.triathlon.repo.SportRepository
import com.club.triathlon.repo.UserRepository
import com.club.triathlon.service.storage.StorageService
import com.club.triathlon.util.PhotoUtils
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.http.HttpStatus
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.server.ResponseStatusException
import java.time.LocalDate
import java.time.LocalTime
import java.time.OffsetDateTime
import java.time.format.DateTimeParseException
import java.util.UUID

@Service
class AdminActivityService(
    private val activityRepository: ActivityRepository,
    private val enrollmentRepository: EnrollmentRepository,
    private val paymentRepository: PaymentRepository,
    private val monthlyPaymentRepository: MonthlyPaymentRepository,
    private val invoiceRepository: InvoiceRepository,
    private val userRepository: UserRepository,
    private val locationRepository: LocationRepository,
    private val sportRepository: SportRepository
) {

    @Autowired(required = false)
    private var storageService: StorageService? = null

    @Transactional(readOnly = true)
    fun listActivities(): List<AdminActivityDto> {
        val activities = activityRepository.findAllWithDetails()
        if (activities.isEmpty()) return emptyList()

        val activityIds = activities.mapNotNull { it.id }
        val enrollmentCounts = getEnrollmentCounts(activityIds)

        return activities.map { activity ->
            val (enrolledCount, reservedCount) = enrollmentCounts[activity.id] ?: Pair(0L, 0L)
            activity.toAdminDto(enrolledCount, reservedCount)
        }
    }

    @Transactional(readOnly = true)
    fun listActivitiesForCoach(coachId: UUID): List<AdminActivityDto> {
        val activities = activityRepository.findAllByCoachIdWithDetails(coachId)
        if (activities.isEmpty()) return emptyList()

        val activityIds = activities.mapNotNull { it.id }
        val enrollmentCounts = getEnrollmentCounts(activityIds)

        return activities.map { activity ->
            val (enrolledCount, reservedCount) = enrollmentCounts[activity.id] ?: Pair(0L, 0L)
            activity.toAdminDto(enrolledCount, reservedCount)
        }
    }

    @Transactional(readOnly = true)
    fun getActivityDetail(id: UUID): AdminActivityDetailDto {
        val activity = activityRepository.findById(id).orElseThrow {
            ResponseStatusException(HttpStatus.NOT_FOUND, "Activitatea nu a fost găsită")
        }
        return activity.toAdminDetail()
    }

    @Transactional
    fun createActivity(command: AdminActivityCommand): AdminActivityDetailDto {
        val coach = userRepository.findById(command.coachId).orElseThrow {
            ResponseStatusException(HttpStatus.BAD_REQUEST, "Antrenorul nu a fost găsit")
        }

        val location = locationRepository.findById(command.locationId).orElseThrow {
            ResponseStatusException(HttpStatus.BAD_REQUEST, "Locația nu a fost găsită")
        }

        val sport = sportRepository.findByCode(command.sport).orElseThrow {
            ResponseStatusException(HttpStatus.BAD_REQUEST, "Sportul nu a fost găsit")
        }

        val activityDate = parseDate(command.activityDate)
        val startTime = parseTime(command.startTime, "startTime")
        val endTime = parseTime(command.endTime, "endTime")

        if (!endTime.isAfter(startTime)) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Ora de sfârșit trebuie să fie după ora de început")
        }

        val activity = Activity().apply {
            this.name = command.name
            this.description = command.description
            this.sport = sport
            this.coach = coach
            this.location = location
            this.activityDate = activityDate
            this.startTime = startTime
            this.endTime = endTime
            this.price = command.price
            this.currency = command.currency ?: "RON"
            this.capacity = command.capacity
            this.active = command.active ?: true
            this.createdAt = OffsetDateTime.now()
        }

        val saved = activityRepository.save(activity)
        return getActivityDetail(saved.id!!)
    }

    @Transactional
    fun updateActivity(id: UUID, command: AdminActivityCommand): AdminActivityDetailDto {
        val activity = activityRepository.findById(id).orElseThrow {
            ResponseStatusException(HttpStatus.NOT_FOUND, "Activitatea nu a fost găsită")
        }

        val coach = userRepository.findById(command.coachId).orElseThrow {
            ResponseStatusException(HttpStatus.BAD_REQUEST, "Antrenorul nu a fost găsit")
        }

        val location = locationRepository.findById(command.locationId).orElseThrow {
            ResponseStatusException(HttpStatus.BAD_REQUEST, "Locația nu a fost găsită")
        }

        val sport = sportRepository.findByCode(command.sport).orElseThrow {
            ResponseStatusException(HttpStatus.BAD_REQUEST, "Sportul nu a fost găsit")
        }

        val activityDate = parseDate(command.activityDate)
        val startTime = parseTime(command.startTime, "startTime")
        val endTime = parseTime(command.endTime, "endTime")

        if (!endTime.isAfter(startTime)) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Ora de sfârșit trebuie să fie după ora de început")
        }

        activity.apply {
            this.name = command.name
            this.description = command.description
            this.sport = sport
            this.coach = coach
            this.location = location
            this.activityDate = activityDate
            this.startTime = startTime
            this.endTime = endTime
            this.price = command.price
            this.currency = command.currency ?: "RON"
            this.capacity = command.capacity
            this.active = command.active ?: true
            this.updatedAt = OffsetDateTime.now()
        }

        activityRepository.save(activity)
        return getActivityDetail(id)
    }

    @Transactional
    fun updateStatus(id: UUID, active: Boolean) {
        val activity = activityRepository.findById(id).orElseThrow {
            ResponseStatusException(HttpStatus.NOT_FOUND, "Activitatea nu a fost găsită")
        }
        activity.active = active
        activity.updatedAt = OffsetDateTime.now()
        activityRepository.save(activity)
    }

    @Transactional
    fun uploadHeroPhoto(id: UUID, photoBase64: String): AdminActivityDetailDto {
        val activity = activityRepository.findById(id).orElseThrow {
            ResponseStatusException(HttpStatus.NOT_FOUND, "Activitatea nu a fost găsită")
        }
        // Delete old S3 photo if exists
        activity.heroPhotoS3Key?.let { oldKey -> storageService?.delete(oldKey) }
        storageService?.let { storage ->
            val photoData = PhotoUtils.processPhoto(photoBase64)
            val key = storage.generateObjectKey("activities/$id/hero", photoData.second)
            storage.upload(key, photoData.first, photoData.second)
            activity.heroPhotoS3Key = key
            activity.heroPhoto = null
        } ?: run {
            activity.heroPhoto = photoBase64
        }
        activity.updatedAt = OffsetDateTime.now()
        activityRepository.save(activity)
        return getActivityDetail(id)
    }

    @Transactional
    fun deleteHeroPhoto(id: UUID) {
        val activity = activityRepository.findById(id).orElseThrow {
            ResponseStatusException(HttpStatus.NOT_FOUND, "Activitatea nu a fost găsită")
        }
        activity.heroPhotoS3Key?.let { key -> storageService?.delete(key) }
        activity.heroPhoto = null
        activity.heroPhotoS3Key = null
        activity.updatedAt = OffsetDateTime.now()
        activityRepository.save(activity)
    }

    @Transactional(readOnly = true)
    fun getHeroPhoto(id: UUID): String? {
        val activity = activityRepository.findById(id).orElseThrow {
            ResponseStatusException(HttpStatus.NOT_FOUND, "Activitatea nu a fost găsită")
        }
        // If S3 key, generate presigned URL
        activity.heroPhotoS3Key?.let { key ->
            storageService?.let { storage ->
                return storage.generatePresignedUrl(key)
            }
        }
        return activity.heroPhoto
    }

    @Transactional
    fun deleteActivity(id: UUID, force: Boolean = false) {
        val activity = activityRepository.findById(id).orElseThrow {
            ResponseStatusException(HttpStatus.NOT_FOUND, "Activitatea nu a fost găsită")
        }

        val enrollments = enrollmentRepository.findByKindAndEntityId(EnrollmentKind.ACTIVITY, id)

        val activeEnrollments = enrollments.count { it.status == EnrollmentStatus.ACTIVE }
        if (!force && activeEnrollments > 0) {
            throw ResponseStatusException(
                HttpStatus.CONFLICT,
                "Nu se poate șterge activitatea. Există $activeEnrollments înscrieri active. Folosește force=true pentru a șterge activitatea și toate datele asociate."
            )
        }

        if (enrollments.isNotEmpty()) {
            // Delete invoices -> payments -> monthly payments -> enrollments
            val payments = paymentRepository.findByEnrollmentIn(enrollments)
            if (payments.isNotEmpty()) {
                val invoices = payments.mapNotNull { payment -> invoiceRepository.findByPayment(payment) }
                if (invoices.isNotEmpty()) {
                    invoiceRepository.deleteAll(invoices)
                }
                paymentRepository.deleteAll(payments)
            }

            val monthlyPayments = monthlyPaymentRepository.findByEnrollmentIn(enrollments)
            if (monthlyPayments.isNotEmpty()) {
                monthlyPaymentRepository.deleteAll(monthlyPayments)
            }

            enrollmentRepository.deleteAll(enrollments)
        }

        activityRepository.delete(activity)
    }

    private fun getEnrollmentCounts(activityIds: List<UUID>): Map<UUID, Pair<Long, Long>> {
        if (activityIds.isEmpty()) return emptyMap()

        // For activities, enrolledCount includes both ACTIVE and PENDING (total reserved)
        // reservedCount specifically shows PENDING only (awaiting payment confirmation)
        val allEnrollments = try {
            enrollmentRepository.findAll()
                .filter { it.kind == EnrollmentKind.ACTIVITY && it.entityId in activityIds }
        } catch (e: Exception) {
            emptyList()
        }

        val enrolledCounts = allEnrollments
            .filter { it.status == EnrollmentStatus.ACTIVE || it.status == EnrollmentStatus.PENDING }
            .groupBy { it.entityId }
            .mapValues { it.value.size.toLong() }

        val pendingCounts = allEnrollments
            .filter { it.status == EnrollmentStatus.PENDING }
            .groupBy { it.entityId }
            .mapValues { it.value.size.toLong() }

        return activityIds.associateWith { id ->
            Pair(enrolledCounts[id] ?: 0L, pendingCounts[id] ?: 0L)
        }
    }

    private fun parseDate(value: String): LocalDate {
        return try {
            LocalDate.parse(value)
        } catch (ex: DateTimeParseException) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Format invalid pentru dată")
        }
    }

    private fun parseTime(value: String, field: String): LocalTime {
        return try {
            LocalTime.parse(value)
        } catch (ex: DateTimeParseException) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Format invalid pentru '$field'")
        }
    }

    private fun Activity.toAdminDto(enrolledCount: Long, reservedCount: Long) = AdminActivityDto(
        id = this.id!!,
        name = this.name,
        coachName = this.coach.name,
        sport = this.sport.code,
        sportName = this.sport.name,
        location = this.location.name,
        activityDate = this.activityDate.toString(),
        startTime = this.startTime.toString(),
        endTime = this.endTime.toString(),
        price = this.price,
        currency = this.currency,
        capacity = this.capacity,
        active = this.active,
        enrolledCount = enrolledCount,
        reservedCount = reservedCount,
        hasHeroPhoto = this.heroPhotoS3Key != null || !this.heroPhoto.isNullOrBlank()
    )

    private fun Activity.toAdminDetail() = AdminActivityDetailDto(
        id = this.id!!,
        name = this.name,
        description = this.description,
        coachId = this.coach.id!!,
        coachName = this.coach.name,
        sport = this.sport.code,
        sportName = this.sport.name,
        locationId = this.location.id!!,
        locationName = this.location.name,
        activityDate = this.activityDate.toString(),
        startTime = this.startTime.toString(),
        endTime = this.endTime.toString(),
        price = this.price,
        currency = this.currency,
        capacity = this.capacity,
        active = this.active,
        hasHeroPhoto = this.heroPhotoS3Key != null || !this.heroPhoto.isNullOrBlank(),
        createdAt = this.createdAt.toString()
    )
}

// DTOs
data class AdminActivityDto(
    val id: UUID,
    val name: String,
    val coachName: String,
    val sport: String,
    val sportName: String,
    val location: String,
    val activityDate: String,
    val startTime: String,
    val endTime: String,
    val price: Long,
    val currency: String,
    val capacity: Int?,
    val active: Boolean,
    val enrolledCount: Long,
    val reservedCount: Long,
    val hasHeroPhoto: Boolean
)

data class AdminActivityDetailDto(
    val id: UUID,
    val name: String,
    val description: String?,
    val coachId: UUID,
    val coachName: String,
    val sport: String,
    val sportName: String,
    val locationId: UUID,
    val locationName: String,
    val activityDate: String,
    val startTime: String,
    val endTime: String,
    val price: Long,
    val currency: String,
    val capacity: Int?,
    val active: Boolean,
    val hasHeroPhoto: Boolean,
    val createdAt: String
)

data class AdminActivityCommand(
    val name: String,
    val description: String?,
    val coachId: UUID,
    val sport: String,
    val locationId: UUID,
    val activityDate: String,
    val startTime: String,
    val endTime: String,
    val price: Long,
    val currency: String? = "RON",
    val capacity: Int?,
    val active: Boolean? = true
)
