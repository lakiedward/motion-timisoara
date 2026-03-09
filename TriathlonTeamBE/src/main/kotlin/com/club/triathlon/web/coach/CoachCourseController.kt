package com.club.triathlon.web.coach

import com.club.triathlon.enums.Role
import com.club.triathlon.security.UserPrincipal
import com.club.triathlon.service.course.CourseRequest
import com.club.triathlon.service.course.CourseResponse
import com.club.triathlon.service.course.CourseService
import io.swagger.v3.oas.annotations.Operation
import io.swagger.v3.oas.annotations.security.SecurityRequirement
import jakarta.validation.Valid
import org.springframework.security.access.prepost.PreAuthorize
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PatchMapping
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.RestController
import java.util.UUID
import com.club.triathlon.service.enrollment.EnrollmentDto
import com.club.triathlon.service.enrollment.EnrollmentService

@RestController
@RequestMapping("/api/coach/courses")
@PreAuthorize("hasAnyRole('COACH','ADMIN')")
class CoachCourseController(
    private val courseService: CourseService,
    private val enrollmentService: EnrollmentService,
    private val adminCourseService: com.club.triathlon.service.AdminCourseService
) {

    @PostMapping
    @Operation(summary = "Create course", security = [SecurityRequirement(name = "bearerAuth")])
    fun createCourse(
        @AuthenticationPrincipal principal: UserPrincipal,
        @Valid @RequestBody request: CoachCourseRequest
    ): CourseResponse {
        val adjustedRequest = request.adjustForPrincipal(principal)
        return courseService.createCourse(adjustedRequest)
    }

    @PutMapping("/{id}")
    @Operation(summary = "Update course", security = [SecurityRequirement(name = "bearerAuth")])
    fun updateCourse(
        @AuthenticationPrincipal principal: UserPrincipal,
        @PathVariable id: UUID,
        @Valid @RequestBody request: CoachCourseRequest
    ): CourseResponse {
        val adjustedRequest = request.adjustForPrincipal(principal)
        return courseService.updateCourse(id, adjustedRequest)
    }

    @GetMapping
    @Operation(summary = "List courses", security = [SecurityRequirement(name = "bearerAuth")])
    fun listCourses(): List<CourseResponse> = courseService.listCourses()

    @GetMapping("/{id}")
    @Operation(summary = "Get course details", security = [SecurityRequirement(name = "bearerAuth")])
    fun getCourse(
        @PathVariable id: UUID
    ): CourseResponse = courseService.getCourseForCoach(id)

    @GetMapping("/{id}/participants")
    @Operation(summary = "List course participants", security = [SecurityRequirement(name = "bearerAuth")])
    fun listParticipants(
        @PathVariable id: UUID
    ): List<EnrollmentDto> = enrollmentService.listCoachCourseEnrollments(id)

    @GetMapping("/my-summary")
    @Operation(summary = "List admin-like summary for current coach", security = [SecurityRequirement(name = "bearerAuth")])
    fun listSummary(@AuthenticationPrincipal principal: UserPrincipal): List<com.club.triathlon.service.AdminCourseDto> {
        val user = principal.user
        return adminCourseService.listCoursesForCoach(user.id!!)
    }

    @PatchMapping("/{id}/status")
    @Operation(summary = "Toggle course active status", security = [SecurityRequirement(name = "bearerAuth")])
    fun updateStatus(
        @AuthenticationPrincipal principal: UserPrincipal,
        @PathVariable id: UUID,
        @RequestBody payload: CoachStatusRequest
    ): ResponseEntity<Map<String, Boolean>> {
        // Ensure ownership
        val existing = courseService.getCourseForCoach(id)
        if (existing.coachId != principal.user.id) {
            throw org.springframework.web.server.ResponseStatusException(HttpStatus.FORBIDDEN, "Cannot modify this course")
        }
        // Use admin service status update (does not require recurrence rule)
        adminCourseService.updateStatus(id, payload.active)
        return ResponseEntity.ok(mapOf("success" to true))
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Delete own course", security = [SecurityRequirement(name = "bearerAuth")])
    fun deleteCourse(@AuthenticationPrincipal principal: UserPrincipal, @PathVariable id: UUID) {
        // Validate ownership via fetchCourseForUpdate inside delete path of admin service equivalent
        val current = principal.user
        val details = courseService.getCourseForCoach(id)
        if (details.coachId != current.id) {
            throw org.springframework.web.server.ResponseStatusException(HttpStatus.FORBIDDEN, "Cannot delete this course")
        }
        adminCourseService.deleteCourse(id)
    }
}

data class CoachCourseRequest(
    val name: String,
    val sport: String,
    val level: String?,
    val ageFrom: Int?,
    val ageTo: Int?,
    val coachId: UUID?,
    val locationId: UUID,
    val capacity: Int?,
    val price: Long,
    val pricePerSession: Long,
    val packageOptions: String? = null,
    val recurrenceRule: String,
    val active: Boolean,
    val description: String?,
    val heroPhoto: String? = null,
    // Club and payment settings
    val clubId: UUID? = null,
    val paymentRecipient: String = "COACH" // "COACH" or "CLUB"
)

data class CoachStatusRequest(
    val active: Boolean
)

private fun CoachCourseRequest.adjustForPrincipal(principal: UserPrincipal): CourseRequest {
    val currentUser = principal.user
    val effectiveCoachId = if (currentUser.role == Role.COACH) currentUser.id else coachId
    return CourseRequest(
        name = name,
        sport = sport,
        level = level,
        ageFrom = ageFrom,
        ageTo = ageTo,
        coachId = effectiveCoachId,
        locationId = locationId,
        capacity = capacity,
        price = price,
        pricePerSession = pricePerSession,
        packageOptions = packageOptions,
        recurrenceRule = recurrenceRule,
        active = active,
        description = description,
        heroPhoto = heroPhoto,
        clubId = clubId,
        paymentRecipient = paymentRecipient
    )
}
