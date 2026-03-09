package com.club.triathlon.web.account

import com.club.triathlon.security.UserPrincipal
import com.club.triathlon.service.announcement.AnnouncementDto
import com.club.triathlon.service.announcement.AnnouncementService
import io.swagger.v3.oas.annotations.Operation
import io.swagger.v3.oas.annotations.security.SecurityRequirement
import org.springframework.http.ResponseEntity
import org.springframework.security.access.prepost.PreAuthorize
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController
import java.util.UUID

@RestController
@RequestMapping
@PreAuthorize("hasRole('PARENT')")
class ParentAnnouncementController(
    private val announcementService: AnnouncementService
) {

    @GetMapping("/api/parent/courses/{courseId}/announcements")
    @Operation(summary = "List course announcements (parent)", security = [SecurityRequirement(name = "bearerAuth")])
    fun listCourseAnnouncements(
        @AuthenticationPrincipal principal: UserPrincipal,
        @PathVariable courseId: UUID
    ): List<AnnouncementDto> {
        return announcementService.listForParent(courseId, principal.user)
    }

    @GetMapping("/api/parent/announcements")
    @Operation(summary = "Parent announcements feed (aggregated)", security = [SecurityRequirement(name = "bearerAuth")])
    fun listParentFeed(
        @AuthenticationPrincipal principal: UserPrincipal,
        @RequestParam(required = false) courseId: UUID?,
        @RequestParam(required = false, defaultValue = "20") limit: Int
    ): List<AnnouncementDto> {
        return announcementService.listParentFeed(principal.user, courseId, limit)
    }

    @GetMapping("/api/parent/courses/{courseId}/announcements/{announcementId}/images/{imageId}")
    @Operation(summary = "Get announcement image (parent)", security = [SecurityRequirement(name = "bearerAuth")])
    fun getImage(
        @AuthenticationPrincipal principal: UserPrincipal,
        @PathVariable courseId: UUID,
        @PathVariable announcementId: UUID,
        @PathVariable imageId: UUID
    ): ResponseEntity<ByteArray> {
        return announcementService.getImage(courseId, announcementId, imageId, principal.user)
    }

    @GetMapping("/api/parent/courses/{courseId}/announcements/{announcementId}/videos/{videoId}")
    @Operation(summary = "Get announcement video (parent)", security = [SecurityRequirement(name = "bearerAuth")])
    fun getVideo(
        @AuthenticationPrincipal principal: UserPrincipal,
        @PathVariable courseId: UUID,
        @PathVariable announcementId: UUID,
        @PathVariable videoId: UUID
    ): ResponseEntity<ByteArray> {
        return announcementService.getVideo(courseId, announcementId, videoId, principal.user)
    }
}
