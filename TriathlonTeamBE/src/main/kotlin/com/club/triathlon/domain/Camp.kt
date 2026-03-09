package com.club.triathlon.domain

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.Table
import java.time.LocalDate

@Entity
@Table(name = "camps")
open class Camp : BaseEntity() {

    @Column(name = "title", nullable = false)
    lateinit var title: String

    @Column(name = "slug", nullable = false, unique = true)
    lateinit var slug: String

    @Column(name = "description", columnDefinition = "text")
    var description: String? = null

    @Column(name = "period_start", nullable = false)
    lateinit var periodStart: LocalDate

    @Column(name = "period_end", nullable = false)
    lateinit var periodEnd: LocalDate

    @Column(name = "location_text", columnDefinition = "text")
    var locationText: String? = null

    @Column(name = "capacity")
    var capacity: Int? = null

    @Column(name = "price", nullable = false)
    var price: Long = 0

    @Column(name = "currency", nullable = false, length = 10)
    var currency: String = "RON"

    @Column(name = "gallery_json", columnDefinition = "text")
    var galleryJson: String? = null

    @Column(name = "allow_cash", nullable = false)
    var allowCash: Boolean = false
}