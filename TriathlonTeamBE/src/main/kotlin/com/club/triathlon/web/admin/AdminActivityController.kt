package com.club.triathlon.web.admin

import com.club.triathlon.service.AdminActivityCommand
import com.club.triathlon.service.AdminActivityDetailDto
import com.club.triathlon.service.AdminActivityDto
import com.club.triathlon.service.AdminActivityService
import jakarta.validation.Valid
import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.NotNull
import org.springframework.http.HttpStatus
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
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.RestController
import java.util.UUID

@RestController
@RequestMapping("/api/admin/activities")
@PreAuthorize("hasRole('ADMIN')")
class AdminActivityController(
    private val adminActivityService: AdminActivityService
) {

    @GetMapping
    fun listActivities(): List<AdminActivityDto> = adminActivityService.listActivities()

    @GetMapping("/{id}")
    fun getActivity(@PathVariable id: UUID): AdminActivityDetailDto =
        adminActivityService.getActivityDetail(id)

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    fun createActivity(
        @Valid @RequestBody request: AdminActivityRequest
    ): AdminActivityDetailDto {
        return adminActivityService.createActivity(request.toCommand())
    }

    @PutMapping("/{id}")
    fun updateActivity(
        @PathVariable id: UUID,
        @Valid @RequestBody request: AdminActivityRequest
    ): AdminActivityDetailDto {
        return adminActivityService.updateActivity(id, request.toCommand())
    }

    @PatchMapping("/{id}/status")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun updateStatus(
        @PathVariable id: UUID,
        @Valid @RequestBody request: AdminActivityStatusRequest
    ) {
        adminActivityService.updateStatus(id, request.active)
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun deleteActivity(
        @PathVariable id: UUID,
        @RequestParam(required = false, defaultValue = "false") force: Boolean
    ) {
        adminActivityService.deleteActivity(id, force)
    }

    @GetMapping("/{id}/hero-photo")
    fun getHeroPhoto(@PathVariable id: UUID): HeroPhotoResponse {
        val photo = adminActivityService.getHeroPhoto(id)
        return HeroPhotoResponse(photo)
    }

    @PostMapping("/{id}/hero-photo")
    fun uploadHeroPhoto(
        @PathVariable id: UUID,
        @RequestBody request: HeroPhotoRequest
    ): AdminActivityDetailDto {
        return adminActivityService.uploadHeroPhoto(id, request.photo)
    }

    @DeleteMapping("/{id}/hero-photo")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun deleteHeroPhoto(@PathVariable id: UUID) {
        adminActivityService.deleteHeroPhoto(id)
    }
}

data class HeroPhotoRequest(
    @field:NotBlank
    val photo: String
)

data class HeroPhotoResponse(
    val photo: String?
)

data class AdminActivityStatusRequest(
    @field:NotNull
    val active: Boolean
)

data class AdminActivityRequest(
    @field:NotBlank
    val name: String,
    val description: String? = null,
    @field:NotNull
    val coachId: UUID,
    @field:NotBlank
    val sport: String,
    @field:NotNull
    val locationId: UUID,
    @field:NotBlank
    val activityDate: String,
    @field:NotBlank
    val startTime: String,
    @field:NotBlank
    val endTime: String,
    @field:NotNull
    val price: Long,
    val currency: String? = "RON",
    val capacity: Int? = null,
    val active: Boolean? = true
) {
    fun toCommand(): AdminActivityCommand = AdminActivityCommand(
        name = name,
        description = description,
        coachId = coachId,
        sport = sport,
        locationId = locationId,
        activityDate = activityDate,
        startTime = startTime,
        endTime = endTime,
        price = price,
        currency = currency,
        capacity = capacity,
        active = active
    )
}
