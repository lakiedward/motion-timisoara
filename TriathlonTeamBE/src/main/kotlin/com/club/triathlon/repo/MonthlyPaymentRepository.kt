package com.club.triathlon.repo

import com.club.triathlon.domain.Enrollment
import com.club.triathlon.domain.MonthlyPayment
import com.club.triathlon.enums.PaymentStatus
import org.springframework.data.jpa.repository.JpaRepository
import java.util.UUID

interface MonthlyPaymentRepository : JpaRepository<MonthlyPayment, UUID> {
    fun findByEnrollmentAndMonthYear(enrollment: Enrollment, monthYear: String): MonthlyPayment?
    fun findByEnrollmentIn(enrollments: Collection<Enrollment>): List<MonthlyPayment>
    fun findByEnrollmentAndStatusIn(enrollment: Enrollment, statuses: Collection<PaymentStatus>): List<MonthlyPayment>
    fun findByEnrollment(enrollment: Enrollment): List<MonthlyPayment>
}

