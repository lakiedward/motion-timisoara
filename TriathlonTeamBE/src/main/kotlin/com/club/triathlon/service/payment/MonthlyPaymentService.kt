package com.club.triathlon.service.payment

import com.club.triathlon.domain.Enrollment
import com.club.triathlon.domain.MonthlyPayment
import com.club.triathlon.enums.EnrollmentKind
import com.club.triathlon.enums.PaymentMethod
import com.club.triathlon.enums.PaymentStatus
import com.club.triathlon.repo.CourseRepository
import com.club.triathlon.repo.EnrollmentRepository
import com.club.triathlon.repo.MonthlyPaymentRepository
import org.springframework.http.HttpStatus
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.server.ResponseStatusException
import java.time.LocalDate
import java.time.OffsetDateTime
import java.time.YearMonth
import java.time.temporal.ChronoUnit
import java.util.UUID

@Service
class MonthlyPaymentService(
    private val monthlyPaymentRepository: MonthlyPaymentRepository,
    private val enrollmentRepository: EnrollmentRepository,
    private val courseRepository: CourseRepository
) {

    @Transactional
    fun generateMonthlyPayment(enrollment: Enrollment, monthYear: String, amount: Long, currency: String, method: PaymentMethod): MonthlyPayment {
        // Check if already exists
        val existing = monthlyPaymentRepository.findByEnrollmentAndMonthYear(enrollment, monthYear)
        if (existing != null) {
            return existing
        }

        val now = OffsetDateTime.now()
        val monthlyPayment = MonthlyPayment().apply {
            this.enrollment = enrollment
            this.monthYear = monthYear
            this.amount = amount
            this.currency = currency
            this.method = method
            this.status = PaymentStatus.PENDING
            this.createdAt = now
            this.updatedAt = now
        }
        return monthlyPaymentRepository.save(monthlyPayment)
    }

    @Transactional
    fun markMonthlyPaymentPaid(paymentId: UUID, paidByCoachId: UUID?) {
        val payment = monthlyPaymentRepository.findById(paymentId).orElseThrow {
            ResponseStatusException(HttpStatus.NOT_FOUND, "Monthly payment not found")
        }

        if (payment.method != PaymentMethod.CASH) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Only CASH payments can be marked paid manually")
        }

        val enrollment = payment.enrollment

        // If coach is marking, verify they own the course
        if (paidByCoachId != null) {
            if (enrollment.kind != EnrollmentKind.COURSE) {
                throw ResponseStatusException(HttpStatus.FORBIDDEN, "Coach can only mark payments for courses")
            }
            val course = courseRepository.findById(enrollment.entityId).orElseThrow {
                ResponseStatusException(HttpStatus.NOT_FOUND, "Course not found")
            }
            if (course.coach.id != paidByCoachId) {
                throw ResponseStatusException(HttpStatus.FORBIDDEN, "Coach can only mark payments for their own courses")
            }
        }

        val now = OffsetDateTime.now()
        payment.status = PaymentStatus.SUCCEEDED
        payment.paidAt = now
        payment.updatedAt = now
        monthlyPaymentRepository.save(payment)
    }

    @Transactional
    fun unmarkMonthlyPayment(paymentId: UUID, unmarkedByCoachId: UUID?) {
        val payment = monthlyPaymentRepository.findById(paymentId).orElseThrow {
            ResponseStatusException(HttpStatus.NOT_FOUND, "Monthly payment not found")
        }

        if (payment.method != PaymentMethod.CASH) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Only CASH payments can be manually unmarked")
        }

        val enrollment = payment.enrollment

        // If coach is unmarking, verify they own the course
        if (unmarkedByCoachId != null) {
            if (enrollment.kind != EnrollmentKind.COURSE) {
                throw ResponseStatusException(HttpStatus.FORBIDDEN, "Coach can only unmark payments for courses")
            }
            val course = courseRepository.findById(enrollment.entityId).orElseThrow {
                ResponseStatusException(HttpStatus.NOT_FOUND, "Course not found")
            }
            if (course.coach.id != unmarkedByCoachId) {
                throw ResponseStatusException(HttpStatus.FORBIDDEN, "Coach can only unmark payments for their own courses")
            }
        }

        val now = OffsetDateTime.now()
        payment.status = PaymentStatus.PENDING
        payment.paidAt = null
        payment.updatedAt = now
        monthlyPaymentRepository.save(payment)
    }

    fun getChildPaymentStatus(enrollment: Enrollment): ChildPaymentStatusDto {
        val firstSessionDate = enrollment.firstSessionDate ?: LocalDate.now()
        val currentMonth = YearMonth.now().toString() // Format: YYYY-MM

        val currentMonthPayment = monthlyPaymentRepository.findByEnrollmentAndMonthYear(enrollment, currentMonth)
        val currentMonthPaid = currentMonthPayment?.status == PaymentStatus.SUCCEEDED

        // Calculate days until next payment: firstSessionDate + 30 days - today
        val nextPaymentDate = firstSessionDate.plusDays(30)
        val daysUntilPayment = ChronoUnit.DAYS.between(LocalDate.now(), nextPaymentDate).toInt()

        return ChildPaymentStatusDto(
            firstSessionDate = firstSessionDate,
            currentMonthPaid = currentMonthPaid,
            daysUntilNextPayment = daysUntilPayment.coerceAtLeast(0),
            monthlyPaymentId = currentMonthPayment?.id
        )
    }

    fun getCurrentMonthString(): String {
        return YearMonth.now().toString()
    }
}

data class ChildPaymentStatusDto(
    val firstSessionDate: LocalDate,
    val currentMonthPaid: Boolean,
    val daysUntilNextPayment: Int,
    val monthlyPaymentId: UUID?
)

