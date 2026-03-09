package com.club.triathlon.web

import com.club.triathlon.service.AdminCoachService
import com.club.triathlon.service.AdminUserService
import com.club.triathlon.service.CoachDto
import com.club.triathlon.service.CoachInviteRequest
import com.club.triathlon.service.CoachInviteResponse
import com.club.triathlon.service.CoachUpdateRequest
import jakarta.validation.Valid
import jakarta.validation.constraints.NotNull
import org.slf4j.LoggerFactory
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
@RequestMapping("/api/admin/coaches")
@PreAuthorize("hasRole('ADMIN')")
class AdminCoachController(
    private val adminCoachService: AdminCoachService,
    private val adminUserService: AdminUserService
) {
    
    private val logger = LoggerFactory.getLogger(AdminCoachController::class.java)

    @PostMapping("/invite")
    fun inviteCoach(@Valid @RequestBody request: InviteCoachRequest): CoachInviteResponse {
        logger.info("👥 [ADMIN] Coach invitation request for email: ${request.email}, name: ${request.name}")
        
        val serviceRequest = CoachInviteRequest(
            name = request.name,
            email = request.email,
            password = request.password,
            phone = request.phone,
            bio = request.bio,
            sportIds = request.sportIds,
            photo = request.photo
        )
        
        val result = adminCoachService.inviteCoach(serviceRequest)
        logger.info("✅ [ADMIN] Coach invitation successful for email: ${request.email}, coach ID: ${result.coachId}")
        
        return result
    }

    @GetMapping
    fun listCoaches(): List<CoachDto> {
        logger.info("📋 [ADMIN] Listing all coaches")
        val coaches = adminCoachService.listCoaches()
        logger.info("✅ [ADMIN] Retrieved ${coaches.size} coaches")
        return coaches
    }

    @GetMapping("/{id}")
    fun getCoach(@PathVariable id: UUID): CoachDto {
        logger.info("👤 [ADMIN] Getting coach with ID: $id")
        val coach = adminCoachService.getCoachById(id)
        logger.info("✅ [ADMIN] Retrieved coach: ${coach.name}")
        return coach
    }

    @PutMapping("/{id}")
    fun updateCoach(
        @PathVariable id: UUID,
        @Valid @RequestBody request: UpdateCoachRequest
    ): CoachDto {
        logger.info("✏️ [ADMIN] Updating coach with ID: $id")
        
        val serviceRequest = CoachUpdateRequest(
            name = request.name,
            email = request.email,
            password = request.password,
            phone = request.phone,
            bio = request.bio,
            sportIds = request.sportIds,
            photo = request.photo
        )
        
        val result = adminCoachService.updateCoach(id, serviceRequest)
        logger.info("✅ [ADMIN] Coach updated successfully with ID: $id")
        
        return result
    }

    @PatchMapping("/{id}/status")
    fun updateStatus(
        @PathVariable id: UUID,
        @Valid @RequestBody request: CoachStatusUpdateRequest
    ) {
        logger.info("🔄 [ADMIN] Updating coach status for ID: $id, active: ${request.active}")
        adminCoachService.updateStatus(id, request.active)
        logger.info("✅ [ADMIN] Coach status updated successfully for ID: $id")
    }

    @DeleteMapping("/{id}")
    fun deleteCoach(
        @PathVariable id: UUID,
        @RequestParam(defaultValue = "false") force: Boolean
    ) {
        logger.info("🗑️ [ADMIN] Deleting coach with ID: $id (force=$force)")
        adminUserService.deleteUser(id, force)
        logger.info("✅ [ADMIN] Coach deleted successfully with ID: $id")
    }

    @GetMapping("/{id}/photo")
    fun getCoachPhoto(@PathVariable id: UUID): org.springframework.http.ResponseEntity<ByteArray> {
        logger.info("📸 [ADMIN] Retrieving photo for coach ID: $id")
        val result = adminCoachService.getCoachPhoto(id)
        logger.info("✅ [ADMIN] Photo retrieved successfully for coach ID: $id")
        return result
    }
}

data class InviteCoachRequest(
    @field:jakarta.validation.constraints.NotBlank
    val name: String,
    @field:jakarta.validation.constraints.NotBlank
    @field:jakarta.validation.constraints.Email
    val email: String,
    @field:jakarta.validation.constraints.NotBlank
    @field:jakarta.validation.constraints.Size(min = 8)
    val password: String,
    val phone: String?,
    val bio: String?,
    val sportIds: List<UUID>?,
    val photo: String?
)

data class UpdateCoachRequest(
    @field:jakarta.validation.constraints.NotBlank
    val name: String,
    @field:jakarta.validation.constraints.Email
    val email: String?,
    @field:jakarta.validation.constraints.Size(min = 8)
    val password: String?,
    val phone: String?,
    val bio: String?,
    val sportIds: List<UUID>?,
    val photo: String?
)

data class CoachStatusUpdateRequest(
    @field:NotNull
    val active: Boolean
)