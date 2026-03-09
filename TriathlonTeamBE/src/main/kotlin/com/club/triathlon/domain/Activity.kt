package com.club.triathlon.domain

import com.club.triathlon.enums.PaymentRecipientType
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.EnumType
import jakarta.persistence.Enumerated
import jakarta.persistence.FetchType
import jakarta.persistence.JoinColumn
import jakarta.persistence.ManyToOne
import jakarta.persistence.Table
import java.time.LocalDate
import java.time.LocalTime
import java.time.OffsetDateTime

/**
 * Entity representing a one-time activity/event (Activitate).
 * Unlike courses which are recurring, activities happen once at a specific date and time.
 */
@Entity
@Table(name = "activities")
open class Activity : BaseEntity() {

    @Column(name = "name", nullable = false)
    lateinit var name: String

    @Column(name = "description", columnDefinition = "text")
    var description: String? = null

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "sport", nullable = false)
    lateinit var sport: Sport

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "coach_id", nullable = false)
    lateinit var coach: User

    // Club association (optional - null means independent coach activity)
    @ManyToOne(fetch = FetchType.LAZY, optional = true)
    @JoinColumn(name = "club_id", nullable = true)
    var club: Club? = null

    // Who receives online payments for this activity
    @Enumerated(EnumType.STRING)
    @Column(name = "payment_recipient", nullable = false)
    var paymentRecipient: PaymentRecipientType = PaymentRecipientType.COACH

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "location_id", nullable = false)
    lateinit var location: Location

    @Column(name = "activity_date", nullable = false)
    lateinit var activityDate: LocalDate

    @Column(name = "start_time", nullable = false)
    lateinit var startTime: LocalTime

    @Column(name = "end_time", nullable = false)
    lateinit var endTime: LocalTime

    @Column(name = "price", nullable = false)
    var price: Long = 0

    @Column(name = "currency", nullable = false, length = 10)
    var currency: String = "RON"

    @Column(name = "capacity")
    var capacity: Int? = null

    @Column(name = "active", nullable = false)
    var active: Boolean = true

    @Column(name = "hero_photo", columnDefinition = "text")
    var heroPhoto: String? = null

    @Column(name = "hero_photo_s3_key", length = 500)
    var heroPhotoS3Key: String? = null

    @Column(name = "created_at", nullable = false)
    var createdAt: OffsetDateTime = OffsetDateTime.now()

    @Column(name = "updated_at")
    var updatedAt: OffsetDateTime? = null
}
