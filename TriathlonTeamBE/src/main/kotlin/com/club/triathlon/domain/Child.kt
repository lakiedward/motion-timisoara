package com.club.triathlon.domain

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.FetchType
import jakarta.persistence.JoinColumn
import jakarta.persistence.ManyToOne
import jakarta.persistence.Table
import java.time.LocalDate
import java.time.OffsetDateTime

@Entity
@Table(name = "children")
open class Child : BaseEntity() {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "parent_id", nullable = false)
    lateinit var parent: User

    @Column(name = "name", nullable = false)
    lateinit var name: String

    @Column(name = "birth_date", nullable = false)
    lateinit var birthDate: LocalDate

    @Column(name = "level")
    var level: String? = null

    @Column(name = "allergies", columnDefinition = "text")
    var allergies: String? = null

    @Column(name = "emergency_contact_name")
    var emergencyContactName: String? = null

    @Column(name = "emergency_phone")
    var emergencyPhone: String? = null

    @Column(name = "gdpr_consent_at")
    var gdprConsentAt: OffsetDateTime? = null

    @Column(name = "secondary_contact_name")
    var secondaryContactName: String? = null

    @Column(name = "secondary_phone")
    var secondaryPhone: String? = null

    @Column(name = "tshirt_size")
    var tshirtSize: String? = null

    @Column(name = "photo")
    var photo: ByteArray? = null

    @Column(name = "photo_content_type")
    var photoContentType: String? = null
}
