package com.club.triathlon.web.admin

import com.club.triathlon.service.AdminCourseDetailDto
import com.club.triathlon.service.AdminCourseDto
import com.club.triathlon.service.AdminCourseScheduleSlotDto
import com.club.triathlon.service.AdminCourseService
import com.club.triathlon.service.AdminCourseFormCommand
import com.club.triathlon.service.AdminCourseScheduleSlotCommand
import com.club.triathlon.service.AdminCourseUpdateCommand
import jakarta.validation.Valid
import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.NotEmpty
import jakarta.validation.constraints.NotNull
import org.springframework.http.HttpStatus
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
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.RestController
import java.util.UUID

@RestController
@RequestMapping("/api/admin/courses")
@PreAuthorize("hasRole('ADMIN')")
class AdminCourseController(
    private val adminCourseService: AdminCourseService
) {

    @GetMapping
    fun listCourses(): List<AdminCourseDto> = adminCourseService.listCourses()

    @GetMapping("/{id}")
    fun getCourse(
        @PathVariable id: UUID
    ): AdminCourseDetailResponse = adminCourseService.getCourseDetail(id).toResponse()

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    fun createCourse(
        @Valid @RequestBody request: AdminCourseUpdateRequest
    ): AdminCourseDetailResponse {
        val created = adminCourseService.createCourse(request.toCommand())
        return created.toResponse()
    }

    @PutMapping("/{id}")
    fun updateCourse(
        @PathVariable id: UUID,
        @Valid @RequestBody request: AdminCourseUpdateRequest
    ): AdminCourseDetailResponse {
        val updated = adminCourseService.updateCourse(id, request.toCommand())
        return updated.toResponse()
    }

    @PatchMapping("/{id}/status")
    fun updateStatus(
        @PathVariable id: UUID,
        @Valid @RequestBody request: AdminCourseStatusRequest
    ): ResponseEntity<Map<String, Boolean>> {
        adminCourseService.updateStatus(id, request.active)
        return ResponseEntity.ok(mapOf("success" to true))
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun deleteCourse(
        @PathVariable id: UUID,
        @RequestParam(required = false, defaultValue = "false") force: Boolean
    ) {
        adminCourseService.deleteCourse(id, force)
    }

    @GetMapping("/{id}/hero-photo")
    fun getCourseHeroPhoto(@PathVariable id: UUID): org.springframework.http.ResponseEntity<ByteArray> {
        return adminCourseService.getCourseHeroPhoto(id)
    }

    @PostMapping("/{id}/hero-photo")
    fun uploadCourseHeroPhoto(
        @PathVariable id: UUID,
        @Valid @RequestBody request: AdminCourseHeroPhotoRequest
    ): AdminCourseDetailResponse {
        val updated = adminCourseService.uploadHeroPhoto(id, request.photo)
        return updated.toResponse()
    }

    @DeleteMapping("/{id}/hero-photo")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun deleteCourseHeroPhoto(@PathVariable id: UUID) {
        adminCourseService.deleteHeroPhoto(id)
    }

    @PostMapping("/{id}/regenerate-occurrences")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun regenerateOccurrences(@PathVariable id: UUID) {
        adminCourseService.regenerateOccurrences(id)
    }
}

 data class AdminCourseHeroPhotoRequest(
     @field:NotBlank
     val photo: String
 )

data class AdminCourseStatusRequest(
    @field:NotNull
    val active: Boolean
)

data class AdminCourseDetailResponse(
    val id: UUID,
    val name: String,
    val coachId: UUID,
    val coachName: String,
    val sport: String,
    val level: String?,
    val locationId: UUID,
    val location: String?,
    val capacity: Int?,
    val price: Long,
    val active: Boolean,
    val recurrenceRule: String?,
    val ageFrom: Int?,
    val ageTo: Int?,
    val scheduleSlots: List<AdminCourseScheduleSlotResponse>,
    val hasHeroPhoto: Boolean,
    val description: String?
)

data class AdminCourseScheduleSlotResponse(
    val day: String,
    val dayLabel: String,
    val startTime: String,
    val endTime: String
)

data class AdminCourseUpdateRequest(
    @field:NotNull
    val coachId: UUID,
    val recurrenceRule: String? = null,
    @field:NotNull
    val active: Boolean,
    @field:Valid
    val course: AdminCourseFormRequest
) {
    fun toCommand(): AdminCourseUpdateCommand = AdminCourseUpdateCommand(
        coachId = coachId,
        active = active,
        recurrenceRule = recurrenceRule,
        course = AdminCourseFormCommand(
            name = course.name,
            sport = course.sport,
            level = course.level,
            ageFrom = course.ageFrom,
            ageTo = course.ageTo,
            locationId = course.locationId,
            capacity = course.capacity,
            price = course.price,
            pricePerSession = course.pricePerSession,
            packageOptions = course.packageOptions,
            schedule = course.schedule.map {
                AdminCourseScheduleSlotCommand(
                    day = it.day,
                    dayLabel = it.dayLabel,
                    startTime = it.startTime,
                    endTime = it.endTime
                )
            },
            heroPhoto = course.heroPhoto,
            description = course.description
        )
    )
}

data class AdminCourseFormRequest(
    @field:NotBlank
    val name: String,
    @field:NotBlank
    val sport: String,
    val level: String? = null,
    val ageFrom: Int? = null,
    val ageTo: Int? = null,
    val locationId: UUID? = null,
    val capacity: Int? = null,
    @field:NotNull
    val price: Long,
    @field:NotNull
    val pricePerSession: Long,
    val packageOptions: String? = null,
    @field:NotEmpty
    val schedule: List<@Valid AdminCourseScheduleSlotRequest>,
    val heroPhoto: String? = null,
    val description: String? = null
)

data class AdminCourseScheduleSlotRequest(
    @field:NotBlank
    val day: String,
    val dayLabel: String? = null,
    @field:NotBlank
    val startTime: String,
    val endTime: String? = null
)

private fun AdminCourseDetailDto.toResponse(): AdminCourseDetailResponse = AdminCourseDetailResponse(
    id = id,
    name = name,
    coachId = coachId,
    coachName = coachName,
    sport = sport,
    level = level,
    locationId = locationId,
    location = location,
    capacity = capacity,
    price = price,
    active = active,
    recurrenceRule = recurrenceRule,
    ageFrom = ageFrom,
    ageTo = ageTo,
    scheduleSlots = scheduleSlots.map { it.toResponse() },
    hasHeroPhoto = hasHeroPhoto,
    description = description
)

private fun AdminCourseScheduleSlotDto.toResponse(): AdminCourseScheduleSlotResponse = AdminCourseScheduleSlotResponse(
    day = day,
    dayLabel = dayLabel,
    startTime = startTime,
    endTime = endTime
)
