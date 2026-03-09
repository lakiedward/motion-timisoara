package com.club.triathlon.domain

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.FetchType
import jakarta.persistence.JoinColumn
import jakarta.persistence.ManyToOne
import jakarta.persistence.Table
import java.time.OffsetDateTime

@Entity
@Table(name = "course_photos")
open class CoursePhoto : BaseEntity() {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "course_id", nullable = false)
    lateinit var course: Course

    @jakarta.persistence.Lob
    @Column(name = "photo", nullable = false)
    lateinit var photo: ByteArray

    @Column(name = "photo_content_type", nullable = false, length = 100)
    lateinit var photoContentType: String

    @Column(name = "display_order", nullable = false)
    var displayOrder: Int = 0

    @Column(name = "created_at", nullable = false)
    var createdAt: OffsetDateTime = OffsetDateTime.now()

    @Column(name = "updated_at", nullable = false)
    var updatedAt: OffsetDateTime = OffsetDateTime.now()

    @Column(name = "photo_s3_key", length = 500)
    var photoS3Key: String? = null
}

