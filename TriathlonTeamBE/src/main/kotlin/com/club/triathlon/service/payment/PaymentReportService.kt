package com.club.triathlon.service.payment

import com.club.triathlon.enums.EnrollmentKind
import com.club.triathlon.enums.PaymentMethod
import com.club.triathlon.enums.PaymentStatus
import com.club.triathlon.repo.PaymentRepository
import org.springframework.data.domain.Page
import org.springframework.data.domain.PageImpl
import org.springframework.stereotype.Service
import java.time.OffsetDateTime
import java.util.UUID

@Service
class PaymentReportService(
    private val paymentRepository: PaymentRepository
) {

    fun getPayments(
        status: PaymentStatus?,
        method: PaymentMethod?,
        kind: EnrollmentKind?,
        coachId: UUID?,
        from: OffsetDateTime?,
        to: OffsetDateTime?,
        page: Int,
        size: Int
    ): Page<PaymentReportRow> =
        paymentRepository.findPaymentReports(status, method, kind, coachId, from, to, page, size)

    fun exportPayments(
        status: PaymentStatus?,
        method: PaymentMethod?,
        kind: EnrollmentKind?,
        coachId: UUID?,
        from: OffsetDateTime?,
        to: OffsetDateTime?
    ): List<PaymentReportRow> =
        paymentRepository.findPaymentReports(status, method, kind, coachId, from, to)

    fun toCsv(rows: List<PaymentReportRow>): String {
        val header = "childName,parentName,productName,kind,coachName,method,status,amount,createdAt,updatedAt,paymentId,enrollmentId"
        val builder = StringBuilder()
        builder.appendLine(header)
        rows.forEach { row ->
            builder.appendLine(
                listOf(
                    row.childName,
                    row.parentName,
                    row.productName ?: "",
                    row.kind.name,
                    row.coachName ?: "",
                    row.method.name,
                    row.status.name,
                    row.amount.toString(),
                    row.createdAt.toString(),
                    row.updatedAt.toString(),
                    row.paymentId.toString(),
                    row.enrollmentId.toString()
                ).joinToString(",")
            )
        }
        return builder.toString()
    }
}