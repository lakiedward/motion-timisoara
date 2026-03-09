package com.club.triathlon.web.user

import com.club.triathlon.security.UserPrincipal
import com.club.triathlon.service.DsarExportFormat
import com.club.triathlon.service.DsarService
import com.club.triathlon.util.RequestUtils
import io.swagger.v3.oas.annotations.Operation
import io.swagger.v3.oas.annotations.tags.Tag
import jakarta.servlet.http.HttpServletRequest
import jakarta.validation.Valid
import jakarta.validation.constraints.NotNull
import org.springframework.beans.factory.annotation.Value
import org.springframework.http.HttpHeaders
import org.springframework.http.HttpStatus
import org.springframework.http.MediaType
import org.springframework.http.ResponseEntity
import org.springframework.security.access.prepost.PreAuthorize
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.*
import org.springframework.web.server.ResponseStatusException

@RestController
@RequestMapping("/api/dsar")
@Tag(name = "DSAR", description = "Data Subject Access Request endpoints")
class DsarController(
    private val dsarService: DsarService,
    @Value("\${app.security.trusted-proxies:}")
    private val trustedProxiesStr: String
) {

    private val trustedProxies: List<String> by lazy {
        trustedProxiesStr.split(",").map { it.trim() }.filter { it.isNotBlank() }
    }

    @PostMapping("/submit")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Submit a DSAR request")
    fun submitDsar(
        @AuthenticationPrincipal principal: UserPrincipal,
        @Valid @RequestBody request: DsarSubmissionRequest,
        servletRequest: HttpServletRequest
    ): ResponseEntity<Map<String, String>> {
        val ipAddress = RequestUtils.extractClientIp(servletRequest, trustedProxies)

        val userId = principal.user.id
            ?: throw ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authenticated user id is missing")
        
        dsarService.submitDsarRequest(
            userId = userId,
            requestType = request.type.name,
            ipAddress = ipAddress
        )
        
        return ResponseEntity.ok(mapOf("message" to "Request submitted successfully"))
    }

    @GetMapping("/export")
    @Operation(summary = "Export audit logs for the authenticated user")
    @PreAuthorize("isAuthenticated()")
    fun exportData(
        @AuthenticationPrincipal principal: UserPrincipal,
        @RequestParam(name = "format", defaultValue = "JSON") format: DsarExportFormat
    ): ResponseEntity<ByteArray> {
        val userId = principal.user.id
            ?: throw ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authenticated user id is missing")

        val payload = dsarService.exportAuditForSubject(userId, format)
        return ResponseEntity
            .ok()
            .contentType(MediaType.parseMediaType(payload.contentType))
            .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"${payload.fileName}\"")
            .body(payload.bytes)
    }
}

enum class DsarRequestType {
    ACCESS,
    DELETION,
    RECTIFICATION
}

data class DsarSubmissionRequest(
    @field:NotNull
    val type: DsarRequestType
)
