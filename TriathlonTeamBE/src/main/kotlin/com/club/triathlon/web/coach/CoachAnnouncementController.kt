package com.club.triathlon.web.coach

import com.club.triathlon.security.UserPrincipal
import com.club.triathlon.service.announcement.AnnouncementDto
import com.club.triathlon.service.announcement.AnnouncementService
import com.club.triathlon.service.announcement.CreateAnnouncementCmd
import io.swagger.v3.oas.annotations.Operation
import io.swagger.v3.oas.annotations.security.SecurityRequirement
import jakarta.validation.Valid
import jakarta.validation.constraints.NotBlank
import org.springframework.http.HttpStatus
import org.springframework.http.MediaType
import org.springframework.http.ResponseEntity
import org.springframework.security.access.prepost.PreAuthorize
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PatchMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.RestController
import org.springframework.web.multipart.MultipartFile
import java.util.UUID

@RestController
@RequestMapping("/api/coach/courses/{courseId}/announcements")
@PreAuthorize("hasAnyRole('COACH','ADMIN')")
class CoachAnnouncementController(
    private val announcementService: AnnouncementService
) {

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Create announcement", security = [SecurityRequirement(name = "bearerAuth")])
    fun createAnnouncement(
        @AuthenticationPrincipal principal: UserPrincipal,
        @PathVariable courseId: UUID,
        @Valid @RequestBody request: CreateAnnouncementRequest
    ): AnnouncementDto {
        val cmd = CreateAnnouncementCmd(
            content = request.content,
            images = request.images,
            videoUrls = request.videoUrls,
            pinAfterPost = request.pinAfterPost,
            videoFiles = null
        )
        return announcementService.createAnnouncement(courseId, cmd, principal.user)
    }

    @PostMapping(path = ["/upload"])
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Create announcement with files", security = [SecurityRequirement(name = "bearerAuth")])
    fun createAnnouncementMultipart(
        @AuthenticationPrincipal principal: UserPrincipal,
        @PathVariable courseId: UUID,
        @RequestParam("content") content: String,
        @RequestParam("images", required = false) images: List<String>?,
        @RequestParam("videoUrls", required = false) videoUrls: List<String>?,
        @RequestParam("pinAfterPost", required = false) pinAfterPost: Boolean?,
        @RequestParam("videoFiles", required = false) videoFiles: List<MultipartFile>?
    ): AnnouncementDto {
        val cmd = CreateAnnouncementCmd(
            content = content,
            images = images,
            videoUrls = videoUrls,
            pinAfterPost = pinAfterPost,
            videoFiles = videoFiles
        )
        return announcementService.createAnnouncement(courseId, cmd, principal.user)
    }

    @GetMapping
    @Operation(summary = "List course announcements", security = [SecurityRequirement(name = "bearerAuth")])
    fun listAnnouncements(
        @AuthenticationPrincipal principal: UserPrincipal,
        @PathVariable courseId: UUID
    ): List<AnnouncementDto> {
        return announcementService.listForCoach(courseId, principal.user)
    }

    @GetMapping("/{announcementId}/videos/{videoId}")
    @Operation(summary = "Get announcement video", security = [SecurityRequirement(name = "bearerAuth")])
    fun getVideo(
        @AuthenticationPrincipal principal: UserPrincipal,
        @PathVariable courseId: UUID,
        @PathVariable announcementId: UUID,
        @PathVariable videoId: UUID
    ): ResponseEntity<ByteArray> {
        return announcementService.getVideo(courseId, announcementId, videoId, principal.user)
    }

    @PatchMapping("/{announcementId}/pin")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Pin/Unpin announcement", security = [SecurityRequirement(name = "bearerAuth")])
    fun setPinned(
        @AuthenticationPrincipal principal: UserPrincipal,
        @PathVariable courseId: UUID,
        @PathVariable announcementId: UUID,
        @Valid @RequestBody request: PinRequest
    ) {
        announcementService.setPinned(courseId, announcementId, request.pinned, principal.user)
    }

    @DeleteMapping("/{announcementId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Delete announcement", security = [SecurityRequirement(name = "bearerAuth")])
    fun deleteAnnouncement(
        @AuthenticationPrincipal principal: UserPrincipal,
        @PathVariable courseId: UUID,
        @PathVariable announcementId: UUID
    ) {
        announcementService.deleteAnnouncement(courseId, announcementId, principal.user)
    }

    @GetMapping("/{announcementId}/images/{imageId}")
    @Operation(summary = "Get announcement image", security = [SecurityRequirement(name = "bearerAuth")])
    fun getImage(
        @AuthenticationPrincipal principal: UserPrincipal,
        @PathVariable courseId: UUID,
        @PathVariable announcementId: UUID,
        @PathVariable imageId: UUID
    ): ResponseEntity<ByteArray> {
        return announcementService.getImage(courseId, announcementId, imageId, principal.user)
    }
}

data class CreateAnnouncementRequest(
	val content: String,
	val images: List<String>? = null,
	val videoUrls: List<String>? = null,
	val pinAfterPost: Boolean? = null
)

data class PinRequest(
    val pinned: Boolean
)
