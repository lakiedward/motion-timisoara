package com.club.triathlon.service.payment

import com.club.triathlon.enums.EnrollmentKind
import com.club.triathlon.enums.PaymentMethod
import com.club.triathlon.enums.PaymentStatus
import com.fasterxml.jackson.annotation.JsonProperty
import java.time.OffsetDateTime
import java.util.UUID

data class PaymentReportRow(
    val childName: String,
    val parentName: String,
    val productName: String?,
    val kind: EnrollmentKind,
    val coachName: String?,
    @JsonProperty("paymentMethod")
    val method: PaymentMethod,
    val status: PaymentStatus,
    val amount: Long,
    val createdAt: OffsetDateTime,
    val updatedAt: OffsetDateTime,
    @JsonProperty("id")
    val paymentId: UUID,
    val enrollmentId: UUID,
    val currency: String
) {
    // Allow marking cash payment as paid if it's PENDING and CASH
    val allowMarkCash: Boolean
        get() = status == PaymentStatus.PENDING && method == PaymentMethod.CASH
}