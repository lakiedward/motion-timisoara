package com.club.triathlon.web.enrollment

import com.club.triathlon.security.UserPrincipal
import com.club.triathlon.service.enrollment.ChildValidationResult
import com.club.triathlon.service.enrollment.EnrollmentValidationService
import io.swagger.v3.oas.annotations.Operation
import io.swagger.v3.oas.annotations.security.SecurityRequirement
import jakarta.validation.Valid
import jakarta.validation.constraints.NotEmpty
import org.springframework.http.HttpStatus
import org.springframework.security.access.prepost.PreAuthorize
import org.springframework.security.core.context.SecurityContextHolder
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController
import org.springframework.web.server.ResponseStatusException
import java.util.UUID

@RestController
@RequestMapping("/api/enrollments/validate")
@PreAuthorize("hasRole('PARENT')")
class EnrollmentValidationController(
    private val validationService: EnrollmentValidationService
) {

    @PostMapping
    @Operation(summary = "Validate children for course enrollment", security = [SecurityRequirement(name = "bearerAuth")])
    fun validateChildren(@Valid @RequestBody request: ChildValidationRequest): List<ChildValidationResult> {
        val principal = SecurityContextHolder.getContext().authentication?.principal
        if (principal !is UserPrincipal) {
            throw ResponseStatusException(HttpStatus.UNAUTHORIZED, "Unauthenticated")
        }

        return validationService.validateChildren(
            courseId = request.courseId,
            childIds = request.childIds,
            parentId = principal.user.id!!
        )
    }
}

data class ChildValidationRequest(
    val courseId: UUID,
    @field:NotEmpty
    val childIds: List<UUID>
)

