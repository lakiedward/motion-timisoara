package com.club.triathlon.domain

import com.club.triathlon.enums.EnrollmentKind
import com.club.triathlon.enums.EnrollmentStatus
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.EnumType
import jakarta.persistence.Enumerated
import jakarta.persistence.FetchType
import jakarta.persistence.JoinColumn
import jakarta.persistence.ManyToOne
import jakarta.persistence.Table
import java.time.LocalDate
import java.time.OffsetDateTime
import java.util.UUID

@Entity
@Table(name = "enrollments")
open class Enrollment : BaseEntity() {

    @Enumerated(EnumType.STRING)
    @Column(name = "kind", nullable = false, length = 32)
    lateinit var kind: EnrollmentKind

    @Column(name = "entity_id", nullable = false)
    lateinit var entityId: UUID

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "child_id", nullable = false)
    lateinit var child: Child

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 32)
    lateinit var status: EnrollmentStatus

    @Column(name = "created_at", nullable = false)
    lateinit var createdAt: OffsetDateTime

    @Column(name = "first_session_date")
    var firstSessionDate: LocalDate? = null

    @Column(name = "purchased_sessions", nullable = false)
    var purchasedSessions: Int = 0

    @Column(name = "remaining_sessions", nullable = false)
    var remainingSessions: Int = 0

    @Column(name = "sessions_used", nullable = false)
    var sessionsUsed: Int = 0
}