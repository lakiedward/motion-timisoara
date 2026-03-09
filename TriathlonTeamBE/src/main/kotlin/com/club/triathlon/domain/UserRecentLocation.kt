package com.club.triathlon.domain

import jakarta.persistence.*
import java.time.OffsetDateTime
import java.util.UUID

@Entity
@Table(
    name = "user_recent_locations",
    uniqueConstraints = [UniqueConstraint(columnNames = ["user_id", "location_id"])]
)
class UserRecentLocation {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    var id: UUID? = null

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    lateinit var user: User

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "location_id", nullable = false)
    lateinit var location: Location

    @Column(name = "last_used_at", nullable = false)
    var lastUsedAt: OffsetDateTime = OffsetDateTime.now()

    @Column(name = "use_count", nullable = false)
    var useCount: Int = 1
}
