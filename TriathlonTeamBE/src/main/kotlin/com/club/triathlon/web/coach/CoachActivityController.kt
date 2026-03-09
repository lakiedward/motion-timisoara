package com.club.triathlon.web.coach

import com.club.triathlon.enums.Role
import com.club.triathlon.security.UserPrincipal
import com.club.triathlon.service.AdminActivityCommand
import com.club.triathlon.service.AdminActivityDetailDto
import com.club.triathlon.service.AdminActivityDto
import com.club.triathlon.service.AdminActivityService
import com.club.triathlon.service.enrollment.EnrollmentDto
import com.club.triathlon.service.enrollment.EnrollmentService
import com.club.triathlon.service.payment.PaymentService
import io.swagger.v3.oas.annotations.Operation
import io.swagger.v3.oas.annotations.security.SecurityRequirement
import jakarta.validation.Valid
import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.NotNull
import org.springframework.http.HttpStatus
import org.springframework.security.access.prepost.PreAuthorize
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PatchMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.RestController
import org.springframework.web.server.ResponseStatusException
import java.util.UUID

@RestController
@RequestMapping("/api/coach/activities")
@PreAuthorize("hasAnyRole('COACH','ADMIN')")
class CoachActivityController(
    private val adminActivityService: AdminActivityService,
    private val enrollmentService: EnrollmentService,
    private val paymentService: PaymentService
) {

    @GetMapping
    @Operation(summary = "List activities for current coach", security = [SecurityRequirement(name = "bearerAuth")])
    fun listActivities(@AuthenticationPrincipal principal: UserPrincipal): List<AdminActivityDto> {
        val user = principal.user
        return if (user.role == Role.ADMIN) {
            adminActivityService.listActivities()
        } else {
            adminActivityService.listActivitiesForCoach(user.id!!)
        }
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get activity details", security = [SecurityRequirement(name = "bearerAuth")])
    fun getActivity(
        @AuthenticationPrincipal principal: UserPrincipal,
        @PathVariable id: UUID
    ): AdminActivityDetailDto {
        val activity = adminActivityService.getActivityDetail(id)
        val user = principal.user
        // Coaches can only view their own activities
        if (user.role == Role.COACH && activity.coachId != user.id) {
            throw ResponseStatusException(HttpStatus.FORBIDDEN, "Nu aveți acces la această activitate")
        }
        return activity
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Create activity", security = [SecurityRequirement(name = "bearerAuth")])
    fun createActivity(
        @AuthenticationPrincipal principal: UserPrincipal,
        @Valid @RequestBody request: CoachActivityRequest
    ): AdminActivityDetailDto {
        val command = request.toCommand(principal)
        return adminActivityService.createActivity(command)
    }

    @PutMapping("/{id}")
    @Operation(summary = "Update activity", security = [SecurityRequirement(name = "bearerAuth")])
    fun updateActivity(
        @AuthenticationPrincipal principal: UserPrincipal,
        @PathVariable id: UUID,
        @Valid @RequestBody request: CoachActivityRequest
    ): AdminActivityDetailDto {
        // Check ownership
        val existing = adminActivityService.getActivityDetail(id)
        val user = principal.user
        if (user.role == Role.COACH && existing.coachId != user.id) {
            throw ResponseStatusException(HttpStatus.FORBIDDEN, "Nu puteți modifica această activitate")
        }
        val command = request.toCommand(principal)
        return adminActivityService.updateActivity(id, command)
    }

    @PatchMapping("/{id}/status")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Toggle activity status", security = [SecurityRequirement(name = "bearerAuth")])
    fun updateStatus(
        @AuthenticationPrincipal principal: UserPrincipal,
        @PathVariable id: UUID,
        @RequestBody payload: CoachActivityStatusRequest
    ) {
        val existing = adminActivityService.getActivityDetail(id)
        val user = principal.user
        if (user.role == Role.COACH && existing.coachId != user.id) {
            throw ResponseStatusException(HttpStatus.FORBIDDEN, "Nu puteți modifica această activitate")
        }
        adminActivityService.updateStatus(id, payload.active)
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Delete activity", security = [SecurityRequirement(name = "bearerAuth")])
    fun deleteActivity(
        @AuthenticationPrincipal principal: UserPrincipal,
        @PathVariable id: UUID
    ) {
        val existing = adminActivityService.getActivityDetail(id)
        val user = principal.user
        if (user.role == Role.COACH && existing.coachId != user.id) {
            throw ResponseStatusException(HttpStatus.FORBIDDEN, "Nu puteți șterge această activitate")
        }
        adminActivityService.deleteActivity(id)
    }

    @GetMapping("/{id}/hero-photo")
    @Operation(summary = "Get activity hero photo", security = [SecurityRequirement(name = "bearerAuth")])
    fun getHeroPhoto(
        @AuthenticationPrincipal principal: UserPrincipal,
        @PathVariable id: UUID
    ): CoachHeroPhotoResponse {
        val existing = adminActivityService.getActivityDetail(id)
        val user = principal.user
        if (user.role == Role.COACH && existing.coachId != user.id) {
            throw ResponseStatusException(HttpStatus.FORBIDDEN, "Nu aveți acces la această activitate")
        }
        val photo = adminActivityService.getHeroPhoto(id)
        return CoachHeroPhotoResponse(photo)
    }

    @PostMapping("/{id}/hero-photo")
    @Operation(summary = "Upload activity hero photo", security = [SecurityRequirement(name = "bearerAuth")])
    fun uploadHeroPhoto(
        @AuthenticationPrincipal principal: UserPrincipal,
        @PathVariable id: UUID,
        @RequestBody request: CoachHeroPhotoRequest
    ): AdminActivityDetailDto {
        val existing = adminActivityService.getActivityDetail(id)
        val user = principal.user
        if (user.role == Role.COACH && existing.coachId != user.id) {
            throw ResponseStatusException(HttpStatus.FORBIDDEN, "Nu puteți modifica această activitate")
        }
        return adminActivityService.uploadHeroPhoto(id, request.photo)
    }

    @DeleteMapping("/{id}/hero-photo")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Delete activity hero photo", security = [SecurityRequirement(name = "bearerAuth")])
    fun deleteHeroPhoto(
        @AuthenticationPrincipal principal: UserPrincipal,
        @PathVariable id: UUID
    ) {
        val existing = adminActivityService.getActivityDetail(id)
        val user = principal.user
        if (user.role == Role.COACH && existing.coachId != user.id) {
            throw ResponseStatusException(HttpStatus.FORBIDDEN, "Nu puteți modifica această activitate")
        }
        adminActivityService.deleteHeroPhoto(id)
    }

    @GetMapping("/{id}/participants")
    @Operation(summary = "List activity participants", security = [SecurityRequirement(name = "bearerAuth")])
    fun listParticipants(
        @AuthenticationPrincipal principal: UserPrincipal,
        @PathVariable id: UUID
    ): List<EnrollmentDto> {
        val existing = adminActivityService.getActivityDetail(id)
        val user = principal.user
        if (user.role == Role.COACH && existing.coachId != user.id) {
            throw ResponseStatusException(HttpStatus.FORBIDDEN, "Nu aveți acces la participanții acestei activități")
        }
        return enrollmentService.listCoachActivityEnrollments(id)
    }

    @PostMapping("/{activityId}/payments/{paymentId}/confirm-cash")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Confirm cash payment for activity", security = [SecurityRequirement(name = "bearerAuth")])
    fun confirmCashPayment(
        @AuthenticationPrincipal principal: UserPrincipal,
        @PathVariable activityId: UUID,
        @PathVariable paymentId: UUID
    ) {
        val existing = adminActivityService.getActivityDetail(activityId)
        val user = principal.user
        if (user.role == Role.COACH && existing.coachId != user.id) {
            throw ResponseStatusException(HttpStatus.FORBIDDEN, "Nu puteți confirma plăți pentru această activitate")
        }
        paymentService.markCashPaidByCoach(paymentId, user.id!!)
    }
}

data class CoachHeroPhotoRequest(
    @field:NotBlank
    val photo: String
)

data class CoachHeroPhotoResponse(
    val photo: String?
)

data class CoachActivityStatusRequest(
    val active: Boolean
)

data class CoachActivityRequest(
    @field:NotBlank
    val name: String,
    val description: String? = null,
    val coachId: UUID? = null,  // Optional - will use current user for coaches
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
    fun toCommand(principal: UserPrincipal): AdminActivityCommand {
        val currentUser = principal.user
        val effectiveCoachId = if (currentUser.role == Role.COACH) {
            currentUser.id!!
        } else {
            coachId ?: currentUser.id!!
        }

        return AdminActivityCommand(
            name = name,
            description = description,
            coachId = effectiveCoachId,
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
}
