package com.club.triathlon.repo

import com.club.triathlon.domain.CourseAnnouncement
import com.club.triathlon.domain.CourseAnnouncementAttachment
import org.springframework.data.jpa.repository.JpaRepository
import java.util.UUID

interface CourseAnnouncementAttachmentRepository : JpaRepository<CourseAnnouncementAttachment, UUID> {
    fun findByAnnouncementOrderByDisplayOrder(announcement: CourseAnnouncement): List<CourseAnnouncementAttachment>
}
