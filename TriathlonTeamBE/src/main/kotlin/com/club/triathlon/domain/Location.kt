package com.club.triathlon.domain

import com.club.triathlon.enums.LocationType
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.EnumType
import jakarta.persistence.Enumerated
import jakarta.persistence.FetchType
import jakarta.persistence.JoinColumn
import jakarta.persistence.ManyToOne
import jakarta.persistence.Table

@Entity
@Table(name = "locations")
open class Location : BaseEntity() {

    @Column(name = "name", nullable = false)
    lateinit var name: String

    @Enumerated(EnumType.STRING)
    @Column(name = "type", nullable = false, length = 32)
    lateinit var type: LocationType

    @Column(name = "address", columnDefinition = "text")
    var address: String? = null

    @Column(name = "city")
    var city: String? = null

    @Column(name = "lat")
    var lat: Double? = null

    @Column(name = "lng")
    var lng: Double? = null

    @Column(name = "capacity")
    var capacity: Int? = null

    @Column(name = "description", columnDefinition = "text")
    var description: String? = null

    @Column(name = "is_active", nullable = false)
    var isActive: Boolean = true

    // Optional club ownership - null means it's a global/admin location
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "club_id")
    var club: Club? = null

    // Track who created this location
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by_user_id")
    var createdByUser: User? = null
}