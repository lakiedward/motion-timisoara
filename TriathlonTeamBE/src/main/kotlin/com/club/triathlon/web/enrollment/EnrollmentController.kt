package com.club.triathlon.web.enrollment

import com.club.triathlon.enums.EnrollmentKind
import com.club.triathlon.enums.EnrollmentStatus
import com.club.triathlon.enums.PaymentMethod
import org.springframework.http.HttpStatus
import org.springframework.web.server.ResponseStatusException
import com.club.triathlon.service.enrollment.EnrollmentCreateResponse
import com.club.triathlon.service.enrollment.EnrollmentDto
import com.club.triathlon.service.enrollment.EnrollmentRequest
import com.club.triathlon.service.enrollment.EnrollmentService
import io.swagger.v3.oas.annotations.Operation
import io.swagger.v3.oas.annotations.security.SecurityRequirement
import jakarta.validation.Valid
import jakarta.validation.constraints.NotNull
import org.springframework.security.access.prepost.PreAuthorize
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController
import java.util.UUID

@RestController
@RequestMapping
class EnrollmentController(
    private val enrollmentService: EnrollmentService
) {

    @PostMapping("/api/enrollments")
    @Operation(summary = "Create enrollment", security = [SecurityRequirement(name = "bearerAuth")])
    @PreAuthorize("hasRole('PARENT')")
    fun createEnrollment(@Valid @RequestBody request: EnrollmentPayload): EnrollmentCreateResponse {
        val childIds = request.childIds
            ?: request.childId?.let { listOf(it) }
            ?: throw ResponseStatusException(HttpStatus.BAD_REQUEST, "At least one child must be specified")

        val serviceRequest = EnrollmentRequest(
            kind = request.kind,
            entityId = request.entityId,
            childIds = childIds,
            paymentMethod = request.paymentMethod,
            sessionPackageSize = request.sessionPackageSize,
            billingDetails = request.billingDetails?.let {
                com.club.triathlon.service.enrollment.BillingDetailsRequest(
                    name = it.name,
                    email = it.email,
                    addressLine1 = it.addressLine1,
                    city = it.city,
                    postalCode = it.postalCode
                )
            }
        )
        return enrollmentService.createEnrollment(serviceRequest)
    }

    @GetMapping("/api/parent/enrollments")
    @Operation(summary = "Parent enrollments", security = [SecurityRequirement(name = "bearerAuth")])
    @PreAuthorize("hasRole('PARENT')")
    fun listParentEnrollments(): List<EnrollmentDto> = enrollmentService.listParentEnrollments()

    @GetMapping("/api/coach/courses/{courseId}/enrollments")
    @Operation(summary = "Course enrollments", security = [SecurityRequirement(name = "bearerAuth")])
    @PreAuthorize("hasRole('COACH')")
    fun listCourseEnrollments(@PathVariable courseId: UUID): List<EnrollmentDto> =
        enrollmentService.listCoachCourseEnrollments(courseId)

    @GetMapping("/api/admin/enrollments")
    @Operation(summary = "Admin enrollments", security = [SecurityRequirement(name = "bearerAuth")])
    @PreAuthorize("hasRole('ADMIN')")
    fun listAdminEnrollments(
        @RequestParam(required = false) kind: EnrollmentKind?,
        @RequestParam(required = false) status: EnrollmentStatus?,
        @RequestParam(required = false) coachId: UUID?
    ): List<EnrollmentDto> = enrollmentService.listAdminEnrollments(kind, status, coachId)

    @PostMapping("/api/enrollments/{enrollmentId}/cancel-draft")
    @Operation(summary = "Cancel draft enrollment", security = [SecurityRequirement(name = "bearerAuth")])
    @PreAuthorize("hasRole('PARENT')")
    fun cancelDraftEnrollment(@PathVariable enrollmentId: UUID): ResponseEntity<Void> {
        enrollmentService.cancelDraftEnrollment(enrollmentId)
        return ResponseEntity.noContent().build()
    }
}

data class EnrollmentPayload(
    @field:NotNull
    val kind: EnrollmentKind,
    @field:NotNull
    val entityId: UUID,
    val childId: UUID? = null,
    val childIds: List<UUID>? = null,
    @field:NotNull
    val paymentMethod: PaymentMethod,
    val sessionPackageSize: Int? = null,
    val billingDetails: BillingDetailsPayload? = null
)

data class BillingDetailsPayload(
    @field:NotNull
    val name: String,
    @field:NotNull
    @jakarta.validation.constraints.Email
    val email: String,
    @field:NotNull
    val addressLine1: String,
    @field:NotNull
    val city: String,
    @field:NotNull
    val postalCode: String
)
