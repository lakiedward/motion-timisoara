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

@Entity
@Table(name = "courses")
open class Course : BaseEntity() {

    @Column(name = "name", nullable = false)
    lateinit var name: String

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "sport", nullable = false)
    lateinit var sport: Sport

    @Column(name = "level")
    var level: String? = null

    @Column(name = "age_from")
    var ageFrom: Int? = null

    @Column(name = "age_to")
    var ageTo: Int? = null

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "coach_id", nullable = false)
    lateinit var coach: User

    // Club association (optional - null means independent coach course)
    @ManyToOne(fetch = FetchType.LAZY, optional = true)
    @JoinColumn(name = "club_id", nullable = true)
    var club: Club? = null

    // Who receives online payments for this course
    @Enumerated(EnumType.STRING)
    @Column(name = "payment_recipient", nullable = false)
    var paymentRecipient: PaymentRecipientType = PaymentRecipientType.COACH

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "location_id", nullable = false)
    lateinit var location: Location

    @Column(name = "capacity")
    var capacity: Int? = null

    @Column(name = "price", nullable = false)
    var price: Long = 0

    @Column(name = "currency", nullable = false, length = 10)
    var currency: String = "RON"

    @Column(name = "price_per_session", nullable = false)
    var pricePerSession: Long = 0

    @Column(name = "package_options", columnDefinition = "text")
    var packageOptions: String? = null

    @Column(name = "recurrence_rule", columnDefinition = "text")
    var recurrenceRule: String? = null

    @Column(name = "active", nullable = false)
    var active: Boolean = true

    @Column(name = "description", columnDefinition = "text")
    var description: String? = null

    @jakarta.persistence.Lob
    @Column(name = "hero_photo")
    var heroPhoto: ByteArray? = null

    @Column(name = "hero_photo_content_type", length = 100)
    var heroPhotoContentType: String? = null

    @Column(name = "hero_photo_s3_key", length = 500)
    var heroPhotoS3Key: String? = null
}