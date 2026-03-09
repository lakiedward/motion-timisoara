package com.club.triathlon.repo

import com.club.triathlon.enums.EnrollmentKind
import com.club.triathlon.enums.PaymentMethod
import com.club.triathlon.enums.PaymentStatus
import java.time.OffsetDateTime
import java.util.UUID

interface PaymentReportRepositoryCustom {
    fun findPaymentReports(
        status: PaymentStatus?,
        method: PaymentMethod?,
        kind: EnrollmentKind?,
        coachId: UUID?,
        from: OffsetDateTime?,
        to: OffsetDateTime?,
        page: Int,
        size: Int
    ): org.springframework.data.domain.Page<com.club.triathlon.service.payment.PaymentReportRow>

    fun findPaymentReports(
        status: PaymentStatus?,
        method: PaymentMethod?,
        kind: EnrollmentKind?,
        coachId: UUID?,
        from: OffsetDateTime?,
        to: OffsetDateTime?
    ): List<com.club.triathlon.service.payment.PaymentReportRow>
}
