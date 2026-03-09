package com.club.triathlon.domain

import com.club.triathlon.enums.InvoiceStatus
import com.club.triathlon.enums.InvoiceType
import com.club.triathlon.enums.IssuerType
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
@Table(name = "invoices")
open class Invoice : BaseEntity() {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "payment_id", nullable = false)
    lateinit var payment: Payment

    // SmartBill reference
    @Column(name = "smartbill_series", length = 20)
    var smartbillSeries: String? = null

    @Column(name = "smartbill_number", length = 50)
    var smartbillNumber: String? = null

    @Column(name = "smartbill_id", length = 100)
    var smartbillId: String? = null

    // Invoice details
    @Enumerated(EnumType.STRING)
    @Column(name = "invoice_type", nullable = false, length = 20)
    lateinit var invoiceType: InvoiceType

    @Enumerated(EnumType.STRING)
    @Column(name = "issuer_type", nullable = false, length = 20)
    lateinit var issuerType: IssuerType

    // Amounts (in smallest currency unit - bani for RON)
    @Column(name = "subtotal", nullable = false)
    var subtotal: Long = 0

    @Column(name = "vat_amount", nullable = false)
    var vatAmount: Long = 0

    @Column(name = "total_amount", nullable = false)
    var totalAmount: Long = 0

    @Column(name = "platform_fee", nullable = false)
    var platformFee: Long = 0

    @Column(name = "platform_fee_vat", nullable = false)
    var platformFeeVat: Long = 0

    @Column(name = "coach_amount", nullable = false)
    var coachAmount: Long = 0

    // Status
    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    var status: InvoiceStatus = InvoiceStatus.PENDING

    @Column(name = "anaf_index", length = 100)
    var anafIndex: String? = null

    // Timestamps
    @Column(name = "created_at", nullable = false)
    lateinit var createdAt: OffsetDateTime

    @Column(name = "sent_at")
    var sentAt: OffsetDateTime? = null

    @Column(name = "anaf_submitted_at")
    var anafSubmittedAt: OffsetDateTime? = null

    // Error tracking
    @Column(name = "error_message", columnDefinition = "TEXT")
    var errorMessage: String? = null

    /**
     * Get total platform fee including VAT
     */
    fun getTotalPlatformFee(): Long = platformFee + platformFeeVat

    /**
     * Check if invoice was successfully processed
     */
    fun isSuccessful(): Boolean = status == InvoiceStatus.COMPLETED || status == InvoiceStatus.ANAF_SUBMITTED

    /**
     * Get SmartBill full reference (series + number)
     */
    fun getSmartBillReference(): String? {
        return if (smartbillSeries != null && smartbillNumber != null) {
            "$smartbillSeries $smartbillNumber"
        } else null
    }
}
