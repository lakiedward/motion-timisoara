package com.club.triathlon.domain

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.FetchType
import jakarta.persistence.JoinColumn
import jakarta.persistence.ManyToOne
import jakarta.persistence.Table
import java.time.OffsetDateTime

@Entity
@Table(name = "course_occurrences")
open class CourseOccurrence : BaseEntity() {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "course_id", nullable = false)
    lateinit var course: Course

    @Column(name = "starts_at", nullable = false)
    lateinit var startsAt: OffsetDateTime

    @Column(name = "ends_at", nullable = false)
    lateinit var endsAt: OffsetDateTime
}