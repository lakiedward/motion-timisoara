package com.club.triathlon.domain

import com.club.triathlon.enums.AnnouncementAttachmentType
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.EnumType
import jakarta.persistence.Enumerated
import jakarta.persistence.FetchType
import jakarta.persistence.JoinColumn
import jakarta.persistence.ManyToOne
import jakarta.persistence.Table
import java.time.OffsetDateTime

@Entity
@Table(name = "announcement_attachments")
open class CourseAnnouncementAttachment : BaseEntity() {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "announcement_id", nullable = false)
    lateinit var announcement: CourseAnnouncement

    @Enumerated(EnumType.STRING)
    @Column(name = "type", nullable = false, length = 32)
    lateinit var type: AnnouncementAttachmentType

    @Column(name = "display_order", nullable = false)
    var displayOrder: Int = 0

    @Column(name = "image")
    var image: ByteArray? = null

    @Column(name = "image_content_type", length = 100)
    var imageContentType: String? = null

    @Column(name = "video")
    var video: ByteArray? = null

    @Column(name = "video_content_type", length = 100)
    var videoContentType: String? = null

    @Column(name = "url", length = 1024)
    var url: String? = null

    @Column(name = "image_s3_key", length = 500)
    var imageS3Key: String? = null

    @Column(name = "video_s3_key", length = 500)
    var videoS3Key: String? = null

    @Column(name = "created_at", nullable = false)
    var createdAt: OffsetDateTime = OffsetDateTime.now()
}
