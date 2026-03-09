package com.club.triathlon.web.admin

import com.club.triathlon.service.camp.CampAdminService
import com.club.triathlon.service.camp.CampDto
import com.club.triathlon.service.camp.CampRequest
import jakarta.validation.Valid
import jakarta.validation.constraints.Min
import jakarta.validation.constraints.NotBlank
import io.swagger.v3.oas.annotations.Operation
import io.swagger.v3.oas.annotations.security.SecurityRequirement
import org.springframework.security.access.prepost.PreAuthorize
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController
import java.time.LocalDate
import java.util.UUID

@RestController
@RequestMapping("/api/admin/camps")
@PreAuthorize("hasRole('ADMIN')")
class AdminCampController(
    private val campAdminService: CampAdminService
) {

    @PostMapping
    @Operation(summary = "Create camp", security = [SecurityRequirement(name = "bearerAuth")])
    fun createCamp(@Valid @RequestBody request: CampPayload): CampDto =
        campAdminService.createCamp(request.toRequest())

    @PutMapping("/{id}")
    @Operation(summary = "Update camp", security = [SecurityRequirement(name = "bearerAuth")])
    fun updateCamp(
        @PathVariable id: UUID,
        @Valid @RequestBody request: CampPayload
    ): CampDto = campAdminService.updateCamp(id, request.toRequest())

    @GetMapping
    @Operation(summary = "List camps", security = [SecurityRequirement(name = "bearerAuth")])
    fun listCamps(): List<CampDto> = campAdminService.listCamps()
}

data class CampPayload(
    @field:NotBlank
    val title: String,
    @field:NotBlank
    val slug: String,
    val description: String?,
    val periodStart: LocalDate,
    val periodEnd: LocalDate,
    val locationText: String?,
    @field:Min(1)
    val capacity: Int,
    @field:Min(1)
    val price: Long,
    val galleryJson: String?,
    val allowCash: Boolean
) {
    fun toRequest() = CampRequest(
        title = title,
        slug = slug,
        description = description,
        periodStart = periodStart,
        periodEnd = periodEnd,
        locationText = locationText,
        capacity = capacity,
        price = price,
        galleryJson = galleryJson,
        allowCash = allowCash
    )
}
