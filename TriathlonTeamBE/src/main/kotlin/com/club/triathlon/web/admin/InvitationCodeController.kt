package com.club.triathlon.web.admin

import com.club.triathlon.security.UserPrincipal
import com.club.triathlon.service.CreateInvitationCodeRequest
import com.club.triathlon.service.InvitationCodeDto
import com.club.triathlon.service.InvitationCodeService
import io.swagger.v3.oas.annotations.Operation
import io.swagger.v3.oas.annotations.security.SecurityRequirement
import io.swagger.v3.oas.annotations.tags.Tag
import jakarta.validation.Valid
import jakarta.validation.constraints.Max
import jakarta.validation.constraints.Min
import org.slf4j.LoggerFactory
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.security.access.prepost.PreAuthorize
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController
import java.util.UUID

@RestController
@RequestMapping("/api/admin/invitation-codes")
@PreAuthorize("hasRole('ADMIN')")
@Tag(name = "Admin - Invitation Codes", description = "Manage coach invitation codes")
class InvitationCodeController(
    private val invitationCodeService: InvitationCodeService
) {
    private val logger = LoggerFactory.getLogger(InvitationCodeController::class.java)

    @PostMapping
    @Operation(
        summary = "Create invitation code",
        description = "Generate a new invitation code for coach registration",
        security = [SecurityRequirement(name = "bearerAuth")]
    )
    fun createCode(
        @AuthenticationPrincipal principal: UserPrincipal,
        @Valid @RequestBody request: CreateCodeRequest
    ): ResponseEntity<InvitationCodeDto> {
        logger.info("🎫 [ADMIN] Creating invitation code by admin: ${principal.user.email}")
        
        val serviceRequest = CreateInvitationCodeRequest(
            maxUses = request.maxUses,
            expiresInDays = request.expiresInDays,
            notes = request.notes
        )
        
        val result = invitationCodeService.createCode(principal.user, serviceRequest)
        logger.info("✅ [ADMIN] Invitation code created: ${result.code}")
        
        return ResponseEntity.status(HttpStatus.CREATED).body(result)
    }

    @GetMapping
    @Operation(
        summary = "List all invitation codes",
        description = "Get all invitation codes with their status",
        security = [SecurityRequirement(name = "bearerAuth")]
    )
    fun listCodes(): List<InvitationCodeDto> {
        logger.info("📋 [ADMIN] Listing all invitation codes")
        return invitationCodeService.listCodes()
    }

    @GetMapping("/valid")
    @Operation(
        summary = "List valid invitation codes",
        description = "Get only valid (non-expired, not fully used) invitation codes",
        security = [SecurityRequirement(name = "bearerAuth")]
    )
    fun listValidCodes(): List<InvitationCodeDto> {
        logger.info("📋 [ADMIN] Listing valid invitation codes")
        return invitationCodeService.listValidCodes()
    }

    @GetMapping("/{id}")
    @Operation(
        summary = "Get invitation code details",
        description = "Get details of a specific invitation code",
        security = [SecurityRequirement(name = "bearerAuth")]
    )
    fun getCode(@PathVariable id: UUID): InvitationCodeDto {
        logger.info("🔍 [ADMIN] Getting invitation code: $id")
        return invitationCodeService.getCodeById(id)
    }

    @PostMapping("/{id}/revoke")
    @Operation(
        summary = "Revoke invitation code",
        description = "Revoke an invitation code (set it as expired)",
        security = [SecurityRequirement(name = "bearerAuth")]
    )
    fun revokeCode(@PathVariable id: UUID): ResponseEntity<Map<String, String>> {
        logger.info("🚫 [ADMIN] Revoking invitation code: $id")
        invitationCodeService.revokeCode(id)
        return ResponseEntity.ok(mapOf("message" to "Invitation code revoked"))
    }

    @DeleteMapping("/{id}")
    @Operation(
        summary = "Delete invitation code",
        description = "Delete an unused invitation code",
        security = [SecurityRequirement(name = "bearerAuth")]
    )
    fun deleteCode(@PathVariable id: UUID): ResponseEntity<Void> {
        logger.info("🗑️ [ADMIN] Deleting invitation code: $id")
        invitationCodeService.deleteCode(id)
        return ResponseEntity.noContent().build()
    }
}

data class CreateCodeRequest(
    @field:Min(1)
    @field:Max(100)
    val maxUses: Int = 1,
    
    @field:Min(1)
    @field:Max(365)
    val expiresInDays: Int? = 30,
    
    val notes: String? = null
)
