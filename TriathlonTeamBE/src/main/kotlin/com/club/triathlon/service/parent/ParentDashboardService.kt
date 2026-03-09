package com.club.triathlon.service.parent

import com.club.triathlon.domain.Activity
import com.club.triathlon.domain.Camp
import com.club.triathlon.domain.Course
import com.club.triathlon.domain.CourseOccurrence
import com.club.triathlon.domain.Enrollment
import com.club.triathlon.domain.Payment
import com.club.triathlon.domain.User
import com.club.triathlon.enums.EnrollmentKind
import com.club.triathlon.enums.EnrollmentStatus
import com.club.triathlon.enums.PaymentStatus
import com.club.triathlon.repo.ActivityRepository
import com.club.triathlon.repo.CampRepository
import com.club.triathlon.repo.CourseOccurrenceRepository
import com.club.triathlon.repo.CourseRepository
import com.club.triathlon.repo.EnrollmentRepository
import com.club.triathlon.repo.PaymentRepository
import com.club.triathlon.security.UserPrincipal
import org.springframework.http.HttpStatus
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.server.ResponseStatusException
import java.time.LocalTime
import java.time.OffsetDateTime
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter
import java.util.Locale
import java.util.UUID

@Service
class ParentDashboardService(
    private val enrollmentRepository: EnrollmentRepository,
    private val paymentRepository: PaymentRepository,
    private val courseRepository: CourseRepository,
    private val courseOccurrenceRepository: CourseOccurrenceRepository,
    private val campRepository: CampRepository,
    private val activityRepository: ActivityRepository
) {

    private val localeRo = Locale("ro", "RO")
    private val courseFormatter = DateTimeFormatter.ofPattern("EEEE HH:mm", localeRo)
    private val campFormatter = DateTimeFormatter.ofPattern("d MMM", localeRo)

    @Transactional(readOnly = true)
    fun getOverview(): ParentOverviewDto {
        val parent = currentParent()
        val enrollments = enrollmentRepository.findByParent(parent)
        val enrollmentSummaries = buildEnrollmentSummaries(enrollments)
        val paymentSummaries = buildPaymentSummaries(enrollments, enrollmentSummaries)

        val paymentByEnrollmentId = paymentSummaries.associateBy { it.enrollmentId }
        val enrichedEnrollments = enrollmentSummaries.map { summary ->
            val payment = paymentByEnrollmentId[summary.id] ?: return@map summary
            summary.copy(
                paymentAmount = payment.amount,
                paymentCurrency = payment.currency,
                paymentStatus = payment.status,
                paymentStatusLabel = payment.statusLabel,
                paymentMethod = payment.method,
                invoiceUrl = payment.invoiceUrl
            )
        }

        return ParentOverviewDto(
            enrollments = enrichedEnrollments,
            payments = paymentSummaries
        )
    }

    @Transactional(readOnly = true)
    fun getPayments(limit: Int?): List<ParentPaymentDto> {
        val parent = currentParent()
        val enrollments = enrollmentRepository.findByParent(parent)
        if (enrollments.isEmpty()) return emptyList()
        val summaries = buildEnrollmentSummaries(enrollments)
        val payments = buildPaymentSummaries(enrollments, summaries)
        return if (limit != null && limit > 0) payments.take(limit) else payments
    }

    @Transactional(readOnly = true)
    fun getCalendarEvents(start: OffsetDateTime, end: OffsetDateTime): List<ParentCalendarEventDto> {
        require(!end.isBefore(start)) { "End date must be after start date" }

        val parent = currentParent()
        val enrollments = enrollmentRepository.findByParent(parent)
        if (enrollments.isEmpty()) return emptyList()

        val courseEnrollments = enrollments.filter { it.kind == EnrollmentKind.COURSE }
        val campEnrollments = enrollments.filter { it.kind == EnrollmentKind.CAMP }

        // Resolve child names for single-child enrollments per entity
        val childNameByCourseId: Map<UUID, String?> = courseEnrollments
            .groupBy { it.entityId }
            .mapValues { (_, list) -> if (list.size == 1) list.first().child.name else null }

        val childNameByCampId: Map<UUID, String?> = campEnrollments
            .groupBy { it.entityId }
            .mapValues { (_, list) -> if (list.size == 1) list.first().child.name else null }

        val events = mutableListOf<ParentCalendarEventDto>()

        // Course occurrences within range
        if (courseEnrollments.isNotEmpty()) {
            val courseIds = courseEnrollments.map { it.entityId }
            val coursesById = courseRepository.findAllById(courseIds).associateBy { it.id!! }
            val occurrences = courseOccurrenceRepository.findForCoursesBetween(courseIds, start, end)
            occurrences.forEach { occurrence ->
                val course = coursesById[occurrence.course.id!!]
                if (course != null) {
                    val time = occurrence.startsAt.toLocalTime().toString() // HH:mm:ss, acceptable for FE display
                    events += ParentCalendarEventDto(
                        id = occurrence.id!!,
                        date = occurrence.startsAt,
                        type = "course",
                        title = course.name,
                        location = course.location?.name,
                        time = time,
                        childName = childNameByCourseId[course.id!!]
                    )
                }
            }
        }

        // Camps: add the start date if within range
        if (campEnrollments.isNotEmpty()) {
            val campIds = campEnrollments.map { it.entityId }
            val campsById = campRepository.findAllById(campIds).associateBy { it.id!! }
            campsById.values.forEach { camp ->
                val startAt = camp.periodStart.atTime(LocalTime.MIN).atOffset(ZoneOffset.UTC)
                if ((startAt.isEqual(start) || startAt.isAfter(start)) && (startAt.isEqual(end) || startAt.isBefore(end))) {
                    events += ParentCalendarEventDto(
                        id = camp.id!!,
                        date = startAt,
                        type = "camp",
                        title = camp.title,
                        location = camp.locationText,
                        time = null,
                        childName = childNameByCampId[camp.id!!]
                    )
                }
            }
        }

        return events.sortedBy { it.date }
    }

    @Transactional(readOnly = true)
    fun getUpcomingEvents(limit: Int?): List<ParentCalendarEventDto> {
        val now = OffsetDateTime.now()
        // default window: next 60 days
        val end = now.plusDays(60)
        val events = getCalendarEvents(now, end)
        val effectiveLimit = (limit ?: 10).coerceAtLeast(1)
        return events.take(effectiveLimit)
    }

    private fun buildEnrollmentSummaries(enrollments: List<Enrollment>): List<ParentEnrollmentDto> {
        if (enrollments.isEmpty()) return emptyList()

        val now = OffsetDateTime.now()
        val courseIds = enrollments.filter { it.kind == EnrollmentKind.COURSE }.map { it.entityId }
        val campIds = enrollments.filter { it.kind == EnrollmentKind.CAMP }.map { it.entityId }
        val activityIds = enrollments.filter { it.kind == EnrollmentKind.ACTIVITY }.map { it.entityId }

        val coursesById = if (courseIds.isNotEmpty()) {
            courseRepository.findAllById(courseIds).associateBy { it.id }
        } else emptyMap()

        val campsById = if (campIds.isNotEmpty()) {
            campRepository.findAllById(campIds).associateBy { it.id }
        } else emptyMap()

        val activitiesById = if (activityIds.isNotEmpty()) {
            activityRepository.findAllById(activityIds).associateBy { it.id }
        } else emptyMap()

        val occurrencesByCourseId: Map<UUID?, List<CourseOccurrence>> = if (coursesById.isNotEmpty()) {
            courseOccurrenceRepository
                .findUpcomingOccurrences(coursesById.values, now)
                .groupBy { it.course.id }
                .mapValues { entry -> entry.value.sortedBy { it.startsAt } }
        } else emptyMap()

        return enrollments.sortedBy { it.createdAt }
            .map { enrollment ->
                val childName = enrollment.child.name
                when (enrollment.kind) {
                    EnrollmentKind.COURSE -> buildCourseDto(
                        enrollment,
                        childName,
                        coursesById[enrollment.entityId],
                        occurrencesByCourseId[enrollment.entityId]
                    )
                    EnrollmentKind.CAMP -> buildCampDto(
                        enrollment,
                        childName,
                        campsById[enrollment.entityId]
                    )
                    EnrollmentKind.ACTIVITY -> buildActivityDto(
                        enrollment,
                        childName,
                        activitiesById[enrollment.entityId]
                    )
                }
            }
    }

    private fun buildCourseDto(
        enrollment: Enrollment,
        childName: String,
        course: Course?,
        occurrences: List<CourseOccurrence>?
    ): ParentEnrollmentDto {
        val occurrencesOrEmpty = occurrences.orEmpty()
        val nextOccurrence = occurrencesOrEmpty.firstOrNull()?.startsAt
        val period = when {
            occurrencesOrEmpty.isEmpty() -> course?.recurrenceRule ?: "Program anuntat"
            occurrencesOrEmpty.size == 1 -> courseFormatter.format(occurrencesOrEmpty.first().startsAt)
            else -> occurrencesOrEmpty.take(2).joinToString(" � ") { courseFormatter.format(it.startsAt) }
        }
        val title = course?.name ?: "Curs"
        val location = course?.location?.name
        return ParentEnrollmentDto(
            id = enrollment.id ?: UUID.randomUUID(),
            title = title,
            period = period,
            status = normalizeStatus(enrollment.status),
            statusLabel = enrollmentStatusLabel(enrollment.status),
            childName = childName,
            nextOccurrence = nextOccurrence,
            kind = "course",
            location = location,
            purchasedSessions = enrollment.purchasedSessions,
            remainingSessions = enrollment.remainingSessions,
            sessionsUsed = enrollment.sessionsUsed
        )
    }

    private fun buildCampDto(
        enrollment: Enrollment,
        childName: String,
        camp: Camp?
    ): ParentEnrollmentDto {
        val title = camp?.title ?: "Tabara"
        val period = if (camp != null) {
            val start = campFormatter.format(camp.periodStart)
            val end = campFormatter.format(camp.periodEnd)
            "$start - $end"
        } else {
            "Program anuntat"
        }
        val nextOccurrence = camp?.periodStart?.atTime(LocalTime.MIN)?.atOffset(ZoneOffset.UTC)
        val location = camp?.locationText
        return ParentEnrollmentDto(
            id = enrollment.id ?: UUID.randomUUID(),
            title = title,
            period = period,
            status = normalizeStatus(enrollment.status),
            statusLabel = enrollmentStatusLabel(enrollment.status),
            childName = childName,
            nextOccurrence = nextOccurrence,
            kind = "camp",
            location = location,
            purchasedSessions = null,
            remainingSessions = null,
            sessionsUsed = null
        )
    }

    private fun buildActivityDto(
        enrollment: Enrollment,
        childName: String,
        activity: Activity?
    ): ParentEnrollmentDto {
        val title = activity?.name ?: "Activitate"
        val period = if (activity != null) {
            val date = campFormatter.format(activity.activityDate)
            val time = activity.startTime.toString()
            "$date la $time"
        } else {
            "Program anunțat"
        }
        val nextOccurrence = activity?.activityDate?.atTime(activity.startTime)?.atOffset(ZoneOffset.UTC)
        val location = activity?.location?.name
        return ParentEnrollmentDto(
            id = enrollment.id ?: UUID.randomUUID(),
            title = title,
            period = period,
            status = normalizeStatus(enrollment.status),
            statusLabel = enrollmentStatusLabel(enrollment.status),
            childName = childName,
            nextOccurrence = nextOccurrence,
            kind = "activity",
            location = location,
            purchasedSessions = null,
            remainingSessions = null,
            sessionsUsed = null
        )
    }

    private fun buildPaymentSummaries(
        enrollments: List<Enrollment>,
        summaries: List<ParentEnrollmentDto>
    ): List<ParentPaymentDto> {
        if (enrollments.isEmpty()) return emptyList()
        val payments = paymentRepository.findByEnrollmentIn(enrollments)
        if (payments.isEmpty()) return emptyList()

        val titleByEnrollmentId = summaries.associateBy({ it.id }, { it.title })

        return payments
            .sortedByDescending { it.createdAt }
            .map { payment ->
                val enrollmentId = payment.enrollment.id ?: UUID.randomUUID()
                ParentPaymentDto(
                    id = payment.id ?: UUID.randomUUID(),
                    enrollmentId = enrollmentId,
                    description = titleByEnrollmentId[enrollmentId] ?: "Inscriere",
                    amount = payment.amount,
                    currency = payment.currency,
                    date = payment.createdAt,
                    method = payment.method.name.lowercase(localeRo),
                    status = normalizeStatus(payment.status),
                    statusLabel = paymentStatusLabel(payment.status),
                    invoiceUrl = payment.invoiceUrl
                )
            }
    }

    private fun normalizeStatus(status: EnrollmentStatus): String = when (status) {
        EnrollmentStatus.ACTIVE -> "active"
        EnrollmentStatus.PENDING -> "pending"
        EnrollmentStatus.CANCELLED -> "completed"
    }

    private fun normalizeStatus(status: PaymentStatus): String = when (status) {
        PaymentStatus.PENDING -> "pending"
        PaymentStatus.SUCCEEDED -> "completed"
        PaymentStatus.FAILED -> "failed"
        PaymentStatus.REFUNDED -> "completed"
        PaymentStatus.PARTIAL -> "pending"
    }

    private fun enrollmentStatusLabel(status: EnrollmentStatus): String = when (status) {
        EnrollmentStatus.ACTIVE -> "activ"
        EnrollmentStatus.PENDING -> "in curs"
        EnrollmentStatus.CANCELLED -> "finalizat"
    }

    private fun paymentStatusLabel(status: PaymentStatus): String = when (status) {
        PaymentStatus.PENDING -> "in curs"
        PaymentStatus.SUCCEEDED -> "complet"
        PaymentStatus.FAILED -> "esuat"
        PaymentStatus.REFUNDED -> "returnat"
        PaymentStatus.PARTIAL -> "partial"
    }

    private fun currentParent(): User {
        val authentication = org.springframework.security.core.context.SecurityContextHolder.getContext().authentication
        val principal = authentication?.principal
        if (principal is UserPrincipal) {
            val user = principal.user
            if (user.role != com.club.triathlon.enums.Role.PARENT) {
                throw ResponseStatusException(HttpStatus.FORBIDDEN, "Doar parintii pot accesa aceasta resursa")
            }
            return user
        }
        throw ResponseStatusException(HttpStatus.UNAUTHORIZED, "Unauthenticated")
    }
}

data class ParentOverviewDto(
    val enrollments: List<ParentEnrollmentDto>,
    val payments: List<ParentPaymentDto>
)

data class ParentEnrollmentDto(
    val id: UUID,
    val title: String,
    val period: String?,
    val status: String,
    val statusLabel: String,
    val childName: String?,
    val nextOccurrence: OffsetDateTime?,
    val kind: String,
    val location: String?,
    val paymentAmount: Long? = null,
    val paymentCurrency: String? = null,
    val paymentStatus: String? = null,
    val paymentStatusLabel: String? = null,
    val paymentMethod: String? = null,
    val invoiceUrl: String? = null,
    val purchasedSessions: Int? = null,
    val remainingSessions: Int? = null,
    val sessionsUsed: Int? = null
)

data class ParentPaymentDto(
    val id: UUID,
    val enrollmentId: UUID,
    val description: String,
    val amount: Long,
    val currency: String,
    val date: OffsetDateTime,
    val method: String,
    val status: String,
    val statusLabel: String,
    val invoiceUrl: String?
)

data class ParentCalendarEventDto(
    val id: UUID,
    val date: OffsetDateTime,
    val type: String, // course | camp | attendance
    val title: String,
    val location: String?,
    val time: String?,
    val childName: String?
)
