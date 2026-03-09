package com.club.triathlon.domain

import jakarta.persistence.*
import java.time.OffsetDateTime

enum class AnnouncementPriority {
    LOW, NORMAL, HIGH, URGENT
}

@Entity
@Table(name = "club_announcements")
open class ClubAnnouncement : BaseEntity() {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "club_id", nullable = false)
    lateinit var club: Club

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "author_user_id", nullable = false)
    lateinit var author: User

    @Column(name = "title", nullable = false)
    lateinit var title: String

    @Column(name = "content", nullable = false, columnDefinition = "text")
    lateinit var content: String

    @Enumerated(EnumType.STRING)
    @Column(name = "priority", nullable = false, length = 32)
    var priority: AnnouncementPriority = AnnouncementPriority.NORMAL

    @Column(name = "is_active", nullable = false)
    var isActive: Boolean = true

    @Column(name = "publish_at")
    var publishAt: OffsetDateTime? = null

    @Column(name = "expires_at")
    var expiresAt: OffsetDateTime? = null

    @Column(name = "created_at", nullable = false)
    lateinit var createdAt: OffsetDateTime

    @Column(name = "updated_at", nullable = false)
    lateinit var updatedAt: OffsetDateTime

    @PrePersist
    fun prePersist() {
        val now = OffsetDateTime.now()
        createdAt = now
        updatedAt = now
    }

    @PreUpdate
    fun preUpdate() {
        updatedAt = OffsetDateTime.now()
    }
}
