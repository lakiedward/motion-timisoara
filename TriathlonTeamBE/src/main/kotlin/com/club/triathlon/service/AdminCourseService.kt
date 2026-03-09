package com.club.triathlon.service

import com.club.triathlon.domain.Course
import com.club.triathlon.domain.CourseAnnouncement
import com.club.triathlon.domain.CourseAnnouncementAttachment
import com.club.triathlon.enums.EnrollmentKind
import com.club.triathlon.enums.EnrollmentStatus
import com.club.triathlon.repo.AttendanceRepository
import com.club.triathlon.repo.CourseAnnouncementAttachmentRepository
import com.club.triathlon.repo.CourseAnnouncementRepository
import com.club.triathlon.repo.CourseRatingRepository
import com.club.triathlon.repo.CourseRepository
import com.club.triathlon.repo.CourseOccurrenceRepository
import com.club.triathlon.repo.CoursePhotoRepository
import com.club.triathlon.repo.EnrollmentRepository
import com.club.triathlon.repo.InvoiceRepository
import com.club.triathlon.repo.MonthlyPaymentRepository
import com.club.triathlon.repo.PaymentRepository
import com.club.triathlon.service.course.CourseRequest
import com.club.triathlon.service.course.CourseService
import com.club.triathlon.service.course.RecurrenceRule
import com.club.triathlon.service.course.RecurrenceRuleParser
import com.club.triathlon.service.course.toJson
import com.club.triathlon.service.storage.StorageService
import com.club.triathlon.util.PhotoUtils
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.http.HttpStatus
import org.springframework.http.MediaType
import org.springframework.http.ResponseEntity
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.server.ResponseStatusException
import java.net.URI
import java.time.LocalTime
import java.time.format.DateTimeParseException
import java.util.UUID

@Service
class AdminCourseService(
    private val courseRepository: CourseRepository,
    private val enrollmentRepository: EnrollmentRepository,
    private val courseOccurrenceRepository: CourseOccurrenceRepository,
    private val coursePhotoRepository: CoursePhotoRepository,
    private val attendanceRepository: AttendanceRepository,
    private val courseAnnouncementRepository: CourseAnnouncementRepository,
    private val courseAnnouncementAttachmentRepository: CourseAnnouncementAttachmentRepository,
    private val courseRatingRepository: CourseRatingRepository,
    private val paymentRepository: PaymentRepository,
    private val monthlyPaymentRepository: MonthlyPaymentRepository,
    private val invoiceRepository: InvoiceRepository,
    private val courseService: CourseService,
    private val courseSchedulerService: com.club.triathlon.service.course.CourseSchedulerService
) {

    @Autowired(required = false)
    private var storageService: StorageService? = null

    @Transactional(readOnly = true)
    fun listCourses(): List<AdminCourseDto> {
        val courses = courseRepository.findAllWithCoachAndLocation()
        if (courses.isEmpty()) {
            return emptyList()
        }

        val courseIds = courses.mapNotNull { it.id }
        // Count ACTIVE enrollments (paid/activated)
        val activeCounts = enrollmentRepository
            .countCourses(courseIds, setOf(EnrollmentStatus.ACTIVE))
            .associate { row ->
                val courseId = row[0] as UUID
                val total = (row[1] as Number).toLong()
                courseId to total
            }

        // Count RESERVED seats (PENDING + ACTIVE)
        val reservedCounts = enrollmentRepository
            .countCourses(courseIds, setOf(EnrollmentStatus.PENDING, EnrollmentStatus.ACTIVE))
            .associate { row ->
                val courseId = row[0] as UUID
                val total = (row[1] as Number).toLong()
                courseId to total
            }

        // Calculate paid (sessions > 0) and unpaid (sessions == 0) enrollments per course
        val paidUnpaidCounts = courseIds.associateWith { courseId ->
            val enrollments = enrollmentRepository.findByKindAndEntityId(EnrollmentKind.COURSE, courseId)
                .filter { it.status == EnrollmentStatus.ACTIVE || it.status == EnrollmentStatus.PENDING }
            val paidCount = enrollments.count { it.remainingSessions > 0 }.toLong()
            val unpaidCount = enrollments.count { it.remainingSessions == 0 }.toLong()
            Pair(paidCount, unpaidCount)
        }

        return courses.map { course ->
            val enrolledCount = activeCounts[course.id] ?: 0L
            val reservedCount = reservedCounts[course.id] ?: 0L
            val (paidCount, unpaidCount) = paidUnpaidCounts[course.id] ?: Pair(0L, 0L)
            course.toAdminDto(enrolledCount, reservedCount, paidCount, unpaidCount)
        }
    }

    @Transactional(readOnly = true)
    fun listCoursesForCoach(coachId: UUID): List<AdminCourseDto> {
        val all = courseRepository.findAllWithCoachAndLocation()
        if (all.isEmpty()) return emptyList()

        val courses = all.filter { it.coach?.id == coachId }
        if (courses.isEmpty()) return emptyList()

        val courseIds = courses.mapNotNull { it.id }

        val activeCounts = enrollmentRepository
            .countCourses(courseIds, setOf(EnrollmentStatus.ACTIVE))
            .associate { row ->
                val courseId = row[0] as UUID
                val total = (row[1] as Number).toLong()
                courseId to total
            }

        val reservedCounts = enrollmentRepository
            .countCourses(courseIds, setOf(EnrollmentStatus.PENDING, EnrollmentStatus.ACTIVE))
            .associate { row ->
                val courseId = row[0] as UUID
                val total = (row[1] as Number).toLong()
                courseId to total
            }

        // Calculate paid (sessions > 0) and unpaid (sessions == 0) enrollments per course
        val paidUnpaidCounts = courseIds.associateWith { courseId ->
            val enrollments = enrollmentRepository.findByKindAndEntityId(EnrollmentKind.COURSE, courseId)
                .filter { it.status == EnrollmentStatus.ACTIVE || it.status == EnrollmentStatus.PENDING }
            val paidCount = enrollments.count { it.remainingSessions > 0 }.toLong()
            val unpaidCount = enrollments.count { it.remainingSessions == 0 }.toLong()
            Pair(paidCount, unpaidCount)
        }

        return courses.map { course ->
            val enrolledCount = activeCounts[course.id] ?: 0L
            val reservedCount = reservedCounts[course.id] ?: 0L
            val (paidCount, unpaidCount) = paidUnpaidCounts[course.id] ?: Pair(0L, 0L)
            course.toAdminDto(enrolledCount, reservedCount, paidCount, unpaidCount)
        }
    }

    @Transactional(readOnly = true)
    fun getCourseDetail(id: UUID): AdminCourseDetailDto {
        val course = courseRepository.findById(id).orElseThrow {
            ResponseStatusException(HttpStatus.NOT_FOUND, "Course not found")
        }
        return course.toAdminDetail()
    }

    @Transactional
    fun createCourse(command: AdminCourseUpdateCommand): AdminCourseDetailDto {
        val recurrenceRule = buildRecurrenceRule(command.course.schedule)
            ?: command.recurrenceRule
            ?: throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Programul cursului este obligatoriu")

        val locationId = command.course.locationId
            ?: throw ResponseStatusException(HttpStatus.BAD_REQUEST, "locationId is required")

        val courseRequest = CourseRequest(
            name = command.course.name,
            sport = command.course.sport,
            level = command.course.level,
            ageFrom = command.course.ageFrom,
            ageTo = command.course.ageTo,
            coachId = command.coachId,
            locationId = locationId,
            capacity = command.course.capacity,
            price = command.course.price,
            pricePerSession = command.course.pricePerSession,
            packageOptions = command.course.packageOptions,
            recurrenceRule = recurrenceRule,
            active = command.active,
            description = command.course.description
        )

        val created = courseService.createCourse(courseRequest)
        
        // Process hero photo if provided
        command.course.heroPhoto?.let { base64Photo ->
            val course = courseRepository.findById(created.id).orElseThrow()
            val photoData = PhotoUtils.processPhoto(base64Photo)
            course.heroPhotoContentType = photoData.second
            storageService?.let { storage ->
                val key = storage.generateObjectKey("courses/${created.id}/hero", photoData.second)
                storage.upload(key, photoData.first, photoData.second)
                course.heroPhotoS3Key = key
            } ?: run {
                course.heroPhoto = photoData.first
            }
            courseRepository.save(course)
        }

        return getCourseDetail(created.id)
    }

    @Transactional
    fun updateCourse(id: UUID, command: AdminCourseUpdateCommand): AdminCourseDetailDto {
        val existingCourse = courseRepository.findById(id).orElseThrow {
            ResponseStatusException(HttpStatus.NOT_FOUND, "Course not found")
        }

        val recurrenceRule = buildRecurrenceRule(command.course.schedule)
            ?: command.recurrenceRule
            ?: existingCourse.recurrenceRule
            ?: throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Programul cursului este obligatoriu")

        val locationId = command.course.locationId
            ?: throw ResponseStatusException(HttpStatus.BAD_REQUEST, "locationId is required")

        val courseRequest = CourseRequest(
            name = command.course.name,
            sport = command.course.sport,
            level = command.course.level,
            ageFrom = command.course.ageFrom,
            ageTo = command.course.ageTo,
            coachId = command.coachId,
            locationId = locationId,
            capacity = command.course.capacity,
            price = command.course.price,
            pricePerSession = command.course.pricePerSession,
            packageOptions = command.course.packageOptions,
            recurrenceRule = recurrenceRule,
            active = command.active,
            description = command.course.description
        )

        courseService.updateCourse(id, courseRequest)
        
        // Update hero photo if provided
        command.course.heroPhoto?.let { base64Photo ->
            val course = courseRepository.findById(id).orElseThrow()
            val photoData = PhotoUtils.processPhoto(base64Photo)
            course.heroPhotoContentType = photoData.second
            // Delete old S3 photo if exists
            course.heroPhotoS3Key?.let { oldKey -> storageService?.delete(oldKey) }
            storageService?.let { storage ->
                val key = storage.generateObjectKey("courses/$id/hero", photoData.second)
                storage.upload(key, photoData.first, photoData.second)
                course.heroPhotoS3Key = key
                course.heroPhoto = null
            } ?: run {
                course.heroPhoto = photoData.first
            }
            courseRepository.save(course)
        }
        
        return getCourseDetail(id)
    }

    @Transactional
    fun updateStatus(id: UUID, active: Boolean) {
        val course = courseRepository.findById(id).orElseThrow {
            ResponseStatusException(HttpStatus.NOT_FOUND, "Course not found")
        }
        course.active = active
        courseRepository.save(course)
    }

    @Transactional
    fun deleteCourse(id: UUID, force: Boolean = false) {
        val course = courseRepository.findById(id).orElseThrow {
            ResponseStatusException(HttpStatus.NOT_FOUND, "Course not found")
        }

        val enrollments = enrollmentRepository.findByKindAndEntityId(EnrollmentKind.COURSE, id)
        val activeEnrollments = enrollments.count { it.status == EnrollmentStatus.ACTIVE }
        if (!force && enrollments.isNotEmpty()) {
            throw ResponseStatusException(
                HttpStatus.CONFLICT,
                "Nu se poate sterge cursul. Exista $activeEnrollments inscrieri active si ${enrollments.size} inscrieri totale. Foloseste optiunea 'force delete' pentru a sterge cursul si toate datele asociate."
            )
        }

        if (force && enrollments.isNotEmpty()) {
            // Force delete logic: delete invoices -> payments -> monthly payments -> enrollments
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
        
        // Delete in correct order to avoid foreign key constraint violations:
        // 1. Delete course announcements and their attachments
        val announcements = courseAnnouncementRepository.findByCourseIdOrdered(id)
        if (announcements.isNotEmpty()) {
            for (announcement in announcements) {
                val attachments = courseAnnouncementAttachmentRepository.findByAnnouncementOrderByDisplayOrder(announcement)
                if (attachments.isNotEmpty()) {
                    courseAnnouncementAttachmentRepository.deleteAll(attachments)
                }
            }
            courseAnnouncementRepository.deleteAll(announcements)
        }

        // 2. Delete attendances for all occurrences of this course
        val occurrences = courseOccurrenceRepository.findAllByCourse(course)
        if (occurrences.isNotEmpty()) {
            val attendances = attendanceRepository.findByOccurrenceIn(occurrences)
            if (attendances.isNotEmpty()) {
                attendanceRepository.deleteAll(attendances)
            }
            // 2. Delete all course occurrences
            courseOccurrenceRepository.deleteAll(occurrences)
        }
         
        // 3. Delete all course photos (gallery)
        coursePhotoRepository.deleteByCourse(course)

        // 3.1 Delete course ratings
        val ratings = courseRatingRepository.findAllByCourseId(id)
        if (ratings.isNotEmpty()) {
            courseRatingRepository.deleteAll(ratings)
        }
         
        // 4. Now delete the course itself
        courseRepository.delete(course)
    }

    @Transactional(readOnly = true)
    fun getCourseHeroPhoto(id: UUID): ResponseEntity<ByteArray> {
        val course = courseRepository.findById(id).orElseThrow {
            ResponseStatusException(HttpStatus.NOT_FOUND, "Course not found")
        }

        // If S3 key exists, redirect to presigned URL
        course.heroPhotoS3Key?.let { key ->
            storageService?.let { storage ->
                val presignedUrl = storage.generatePresignedUrl(key)
                return ResponseEntity.status(HttpStatus.FOUND)
                    .location(URI.create(presignedUrl))
                    .build()
            }
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

    @Transactional
    fun uploadHeroPhoto(id: UUID, base64Photo: String): AdminCourseDetailDto {
        val course = courseRepository.findById(id).orElseThrow {
            ResponseStatusException(HttpStatus.NOT_FOUND, "Course not found")
        }

        val photoData = PhotoUtils.processPhoto(base64Photo)
        course.heroPhotoContentType = photoData.second
        // Delete old S3 photo if exists
        course.heroPhotoS3Key?.let { oldKey -> storageService?.delete(oldKey) }
        storageService?.let { storage ->
            val key = storage.generateObjectKey("courses/$id/hero", photoData.second)
            storage.upload(key, photoData.first, photoData.second)
            course.heroPhotoS3Key = key
            course.heroPhoto = null
        } ?: run {
            course.heroPhoto = photoData.first
        }
        courseRepository.save(course)

        return getCourseDetail(id)
    }

    @Transactional
    fun deleteHeroPhoto(id: UUID) {
        val course = courseRepository.findById(id).orElseThrow {
            ResponseStatusException(HttpStatus.NOT_FOUND, "Course not found")
        }

        // Delete from S3 if applicable
        course.heroPhotoS3Key?.let { key -> storageService?.delete(key) }
        course.heroPhoto = null
        course.heroPhotoContentType = null
        course.heroPhotoS3Key = null
        courseRepository.save(course)
    }

    @Transactional
    fun regenerateOccurrences(id: UUID) {
        val course = courseRepository.findById(id).orElseThrow {
            ResponseStatusException(HttpStatus.NOT_FOUND, "Course not found")
        }

        val ruleText = course.recurrenceRule
            ?: throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Course has no recurrence rule")

        try {
            val rule = RecurrenceRuleParser.parse(ruleText)
            courseSchedulerService.regenerateOccurrences(course, rule)
        } catch (ex: Exception) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid recurrence rule: ${ex.message}")
        }
    }

    private fun buildRecurrenceRule(schedule: List<AdminCourseScheduleSlotCommand>): String? {
        if (schedule.isEmpty()) {
            return null
        }
        
        val daySchedules = mutableMapOf<Int, com.club.triathlon.service.course.TimeSlot>()
        
        schedule.forEach { slot ->
            val definition = dayByKey[slot.day.lowercase()]
                ?: throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Ziua '${slot.day}' nu este suportata.")
            val start = parseTime(slot.startTime, "startTime")
            val end = slot.endTime?.let { parseTime(it, "endTime") } ?: start.plusHours(1)
            
            if (!end.isAfter(start)) {
                throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Ora de final trebuie sa fie dupa ora de start pentru ${definition.label}.")
            }
            
            daySchedules[definition.number] = com.club.triathlon.service.course.TimeSlot(start, end)
        }
        
        val rule = RecurrenceRule(daySchedules = daySchedules)
        return rule.toJson()
    }

    private fun parseTime(value: String?, field: String): LocalTime {
        if (value.isNullOrBlank()) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Campul '$field' este obligatoriu")
        }
        return try {
            LocalTime.parse(value)
        } catch (ex: DateTimeParseException) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Format invalid pentru '$field'")
        }
    }

    private fun Course.toAdminDetail(): AdminCourseDetailDto {
        return AdminCourseDetailDto(
            id = this.id!!,
            name = this.name,
            coachId = this.coach.id!!,
            coachName = this.coach.name,
            sport = this.sport.code,
            level = this.level,
            locationId = this.location.id!!,
            location = this.location.name,
            capacity = this.capacity,
            price = this.price,
            pricePerSession = this.pricePerSession,
            packageOptions = this.packageOptions,
            active = this.active,
            recurrenceRule = this.recurrenceRule,
            ageFrom = this.ageFrom,
            ageTo = this.ageTo,
            scheduleSlots = buildScheduleSlots(this),
            hasHeroPhoto = this.heroPhotoS3Key != null || this.heroPhoto != null,
            description = this.description
        )
    }

    private fun buildScheduleSlots(course: Course): List<AdminCourseScheduleSlotDto> {
        val ruleText = course.recurrenceRule ?: return emptyList()
        return try {
            val rule = RecurrenceRuleParser.parse(ruleText)
            rule.days.mapNotNull { number ->
                val definition = dayByNumber[number]
                val timeSlot = rule.getTimeSlot(number)
                if (definition != null && timeSlot != null) {
                    AdminCourseScheduleSlotDto(
                        day = definition.key,
                        dayLabel = definition.label,
                        startTime = timeSlot.start.toString(),
                        endTime = timeSlot.end.toString()
                    )
                } else {
                    null
                }
            }
        } catch (ex: Exception) {
            emptyList()
        }
    }

    private data class DayDefinition(val key: String, val number: Int, val label: String)

    private val dayDefinitions = listOf(
        DayDefinition("monday", 1, "Luni"),
        DayDefinition("tuesday", 2, "Marti"),
        DayDefinition("wednesday", 3, "Miercuri"),
        DayDefinition("thursday", 4, "Joi"),
        DayDefinition("friday", 5, "Vineri"),
        DayDefinition("saturday", 6, "Sambata"),
        DayDefinition("sunday", 7, "Duminica")
    )

    private val dayByNumber = dayDefinitions.associateBy { it.number }
    private val dayByKey = dayDefinitions.associateBy { it.key }
}

data class AdminCourseDto(
    val id: UUID,
    val name: String,
    val coachName: String,
    val sport: String,
    val level: String?,
    val location: String?,
    val capacity: Int?,
    val active: Boolean,
    val enrolledCount: Long,
    val reservedCount: Long,
    val enrolledPaidCount: Long = 0,
    val enrolledUnpaidCount: Long = 0,
    val hasHeroPhoto: Boolean
)

data class AdminCourseDetailDto(
    val id: UUID,
    val name: String,
    val coachId: UUID,
    val coachName: String,
    val sport: String,
    val level: String?,
    val locationId: UUID,
    val location: String?,
    val capacity: Int?,
    val price: Long,
    val pricePerSession: Long,
    val packageOptions: String?,
    val active: Boolean,
    val recurrenceRule: String?,
    val ageFrom: Int?,
    val ageTo: Int?,
    val scheduleSlots: List<AdminCourseScheduleSlotDto>,
    val hasHeroPhoto: Boolean,
    val description: String?
)

data class AdminCourseScheduleSlotDto(
    val day: String,
    val dayLabel: String,
    val startTime: String,
    val endTime: String
)

data class AdminCourseUpdateCommand(
    val coachId: UUID,
    val active: Boolean,
    val recurrenceRule: String?,
    val course: AdminCourseFormCommand
)

data class AdminCourseFormCommand(
    val name: String,
    val sport: String,
    val level: String?,
    val ageFrom: Int?,
    val ageTo: Int?,
    val locationId: UUID?,
    val capacity: Int?,
    val price: Long,
    val pricePerSession: Long,
    val packageOptions: String?,
    val schedule: List<AdminCourseScheduleSlotCommand>,
    val heroPhoto: String?,
    val description: String?
)

data class AdminCourseScheduleSlotCommand(
    val day: String,
    val dayLabel: String?,
    val startTime: String,
    val endTime: String?
)

private fun Course.toAdminDto(enrolledCount: Long, reservedCount: Long, enrolledPaidCount: Long = 0, enrolledUnpaidCount: Long = 0) = AdminCourseDto(
    id = this.id!!,
    name = this.name,
    coachName = this.coach.name,
    sport = this.sport.code,
    level = this.level,
    location = this.location.name,
    capacity = this.capacity,
    active = this.active,
    enrolledCount = enrolledCount,
    reservedCount = reservedCount,
    enrolledPaidCount = enrolledPaidCount,
    enrolledUnpaidCount = enrolledUnpaidCount,
    hasHeroPhoto = this.heroPhotoS3Key != null || this.heroPhoto != null
)




