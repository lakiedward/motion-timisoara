package com.club.triathlon.web.admin

import com.club.triathlon.service.AdminClubDto
import com.club.triathlon.service.AdminClubDetailDto
import com.club.triathlon.service.AdminClubService
import jakarta.validation.Valid
import jakarta.validation.constraints.NotNull
import org.slf4j.LoggerFactory
import org.springframework.http.ResponseEntity
import org.springframework.security.access.prepost.PreAuthorize
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PatchMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController
import java.util.UUID

@RestController
@RequestMapping("/api/admin/clubs")
@PreAuthorize("hasRole('ADMIN')")
class AdminClubController(
    private val adminClubService: AdminClubService
) {
    private val logger = LoggerFactory.getLogger(AdminClubController::class.java)

    @GetMapping
    fun listClubs(): List<AdminClubDto> {
        logger.info("📋 [ADMIN] Listing all clubs")
        val clubs = adminClubService.getAllClubs()
        logger.info("✅ [ADMIN] Retrieved ${clubs.size} clubs")
        return clubs
    }

    @GetMapping("/{id}")
    fun getClub(@PathVariable id: UUID): AdminClubDetailDto {
        logger.info("🏢 [ADMIN] Getting club with ID: $id")
        val club = adminClubService.getClubById(id)
        logger.info("✅ [ADMIN] Retrieved club: ${club.name}")
        return club
    }

    @GetMapping("/{id}/logo")
    fun getLogo(@PathVariable id: UUID): org.springframework.http.ResponseEntity<ByteArray> {
        return adminClubService.getClubLogo(id)
    }

    @PatchMapping("/{id}/status")
    fun updateStatus(
        @PathVariable id: UUID,
        @Valid @RequestBody request: ClubStatusUpdateRequest
    ): ResponseEntity<Map<String, Boolean>> {
        logger.info("🔄 [ADMIN] Updating club status for ID: $id, active: ${request.active}")
        adminClubService.setClubStatus(id, request.active)
        logger.info("✅ [ADMIN] Club status updated successfully for ID: $id")
        return ResponseEntity.ok(mapOf("success" to true))
    }

    @PutMapping("/{id}")
    fun updateClub(
        @PathVariable id: UUID,
        @Valid @RequestBody request: UpdateClubRequest
    ): AdminClubDto {
        logger.info("✏️ [ADMIN] Updating club with ID: $id")
        val updated = adminClubService.updateClub(id, request)
        logger.info("✅ [ADMIN] Club updated successfully with ID: $id")
        return updated
    }

    @DeleteMapping("/{id}")
    fun deleteClub(
        @PathVariable id: UUID,
        @RequestParam(defaultValue = "false") force: Boolean
    ) {
        logger.info("🗑️ [ADMIN] Deleting club with ID: $id (force=$force)")
        adminClubService.deleteClub(id, force)
        logger.info("✅ [ADMIN] Club deleted successfully with ID: $id")
    }

    @PostMapping("/{id}/logo")
    fun uploadLogo(
        @PathVariable id: UUID,
        @Valid @RequestBody request: UploadLogoRequest
    ) {
        logger.info("📸 [ADMIN] Uploading logo for club ID: $id")
        adminClubService.uploadLogo(id, request.logo)
        logger.info("✅ [ADMIN] Logo uploaded successfully for club ID: $id")
    }

    @PutMapping("/{id}/sports")
    fun updateClubSports(
        @PathVariable id: UUID,
        @RequestBody sportIds: List<UUID>
    ) {
        logger.info("⚽ [ADMIN] Updating sports for club ID: $id, sports count: ${sportIds.size}")
        adminClubService.updateClubSports(id, sportIds)
        logger.info("✅ [ADMIN] Sports updated successfully for club ID: $id")
    }
}

data class UploadLogoRequest(
    @field:NotNull
    val logo: String
)

data class UpdateClubRequest(
    val name: String? = null,
    val email: String? = null,
    val phone: String? = null,
    val description: String? = null,
    val address: String? = null,
    val city: String? = null,
    val website: String? = null,
    // Company Info
    val companyName: String? = null,
    val companyCui: String? = null,
    val companyRegNumber: String? = null,
    val companyAddress: String? = null,
    val bankAccount: String? = null,
    val bankName: String? = null
)

data class ClubStatusUpdateRequest(
    @field:NotNull
    val active: Boolean
)
