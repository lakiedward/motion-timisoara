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
@Table(name = "payments")
open class Payment : BaseEntity() {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "enrollment_id", nullable = false)
    lateinit var enrollment: Enrollment

    @Enumerated(EnumType.STRING)
    @Column(name = "method", nullable = false, length = 32)
    lateinit var method: PaymentMethod

    @Column(name = "amount", nullable = false)
    var amount: Long = 0

    @Column(name = "currency", nullable = false, length = 10)
    var currency: String = "RON"

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 32)
    lateinit var status: PaymentStatus

    @Column(name = "gateway_txn_id")
    var gatewayTxnId: String? = null

    @Column(name = "client_secret")
    var clientSecret: String? = null

    @Column(name = "created_at", nullable = false)
    lateinit var createdAt: OffsetDateTime

    @Column(name = "updated_at", nullable = false)
    lateinit var updatedAt: OffsetDateTime

    @Column(name = "paid_at")
    var paidAt: OffsetDateTime? = null

    @Column(name = "billing_name")
    var billingName: String? = null

    @Column(name = "billing_email")
    var billingEmail: String? = null

    @Column(name = "billing_address_line1")
    var billingAddressLine1: String? = null

    @Column(name = "billing_city")
    var billingCity: String? = null

    @Column(name = "billing_postal_code")
    var billingPostalCode: String? = null

    @Column(name = "billing_country")
    var billingCountry: String? = null

    @Column(name = "invoice_url")
    var invoiceUrl: String? = null

    @Column(name = "invoice_id")
    var invoiceId: String? = null

    // Stripe Connect fields
    @Column(name = "stripe_transfer_id")
    var stripeTransferId: String? = null

    @Column(name = "platform_fee_amount")
    var platformFeeAmount: Long? = null

    @Column(name = "coach_payout_amount")
    var coachPayoutAmount: Long? = null
}
