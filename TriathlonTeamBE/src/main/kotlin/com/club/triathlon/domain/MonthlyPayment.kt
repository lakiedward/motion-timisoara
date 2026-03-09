package com.club.triathlon.domain

import com.club.triathlon.enums.PaymentMethod
import com.club.triathlon.enums.PaymentStatus
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.EnumType
import jakarta.persistence.Enumerated
import jakarta.persistence.FetchType
import jakarta.persistence.JoinColumn
import jakarta.persistence.ManyToOne
import jakarta.persistence.Table
import java.time.OffsetDateTime

@Entity
@Table(name = "monthly_payments")
open class MonthlyPayment : BaseEntity() {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "enrollment_id", nullable = false)
    lateinit var enrollment: Enrollment

    @Column(name = "month_year", nullable = false, length = 7)
    lateinit var monthYear: String // Format: YYYY-MM

    @Column(name = "amount", nullable = false)
    var amount: Long = 0

    @Column(name = "currency", nullable = false, length = 10)
    var currency: String = "RON"

    @Enumerated(EnumType.STRING)
    @Column(name = "method", nullable = false, length = 32)
    lateinit var method: PaymentMethod

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 32)
    lateinit var status: PaymentStatus

    @Column(name = "paid_at")
    var paidAt: OffsetDateTime? = null

    @Column(name = "created_at", nullable = false)
    lateinit var createdAt: OffsetDateTime

    @Column(name = "updated_at", nullable = false)
    lateinit var updatedAt: OffsetDateTime
}

