package com.club.triathlon.web.account

import com.club.triathlon.service.parent.ChildDto
import com.club.triathlon.service.parent.ChildRequest
import com.club.triathlon.service.parent.ParentAttendanceDto
import com.club.triathlon.service.parent.ParentChildService
import com.club.triathlon.service.enrollment.EnrollmentDto
import com.club.triathlon.service.enrollment.EnrollmentService
import io.swagger.v3.oas.annotations.Operation
import io.swagger.v3.oas.annotations.security.SecurityRequirement
import jakarta.validation.Valid
import jakarta.validation.constraints.NotBlank
import org.springframework.http.MediaType
import org.springframework.http.ResponseEntity
import org.springframework.security.access.prepost.PreAuthorize
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController
import java.util.UUID

@RestController
@RequestMapping("/api/parent/children")
@PreAuthorize("hasRole('PARENT')")
class ParentChildController(
    private val parentChildService: ParentChildService,
    private val enrollmentService: EnrollmentService
) {

    @GetMapping
    @Operation(summary = "List parent children", security = [SecurityRequirement(name = "bearerAuth")])
    fun listChildren(): List<ChildDto> = parentChildService.listChildren()

    @GetMapping("/{id}")
    @Operation(summary = "Get child profile", security = [SecurityRequirement(name = "bearerAuth")])
    fun getChild(@PathVariable id: UUID): ChildDto = parentChildService.getChild(id)

    @PostMapping
    @Operation(summary = "Create child profile", security = [SecurityRequirement(name = "bearerAuth")])
    fun createChild(@Valid @RequestBody request: ChildRequest): ChildDto = parentChildService.createChild(request)

    @PutMapping("/{id}")
    @Operation(summary = "Update child profile", security = [SecurityRequirement(name = "bearerAuth")])
    fun updateChild(@PathVariable id: UUID, @Valid @RequestBody request: ChildRequest): ChildDto =
        parentChildService.updateChild(id, request)

    @DeleteMapping("/{id}")
    @Operation(summary = "Delete child profile", security = [SecurityRequirement(name = "bearerAuth")])
    fun deleteChild(@PathVariable id: UUID) {
        parentChildService.deleteChild(id)
    }

    @GetMapping("/{id}/attendance")
    @Operation(summary = "Get child attendance history", security = [SecurityRequirement(name = "bearerAuth")])
    fun getChildAttendance(@PathVariable id: UUID): ParentAttendanceDto =
        parentChildService.getChildAttendance(id)

    @GetMapping("/{id}/enrollments")
    @Operation(summary = "List enrollments for a child", security = [SecurityRequirement(name = "bearerAuth")])
    fun getChildEnrollments(@PathVariable id: UUID): List<EnrollmentDto> =
        enrollmentService.listParentEnrollments().filter { it.child.id == id }

    @PostMapping("/{id}/photo")
    @Operation(summary = "Upload/replace child photo", security = [SecurityRequirement(name = "bearerAuth")])
    fun uploadChildPhoto(
        @PathVariable id: UUID,
        @Valid @RequestBody request: PhotoUploadRequest
    ): ResponseEntity<Void> {
        parentChildService.saveChildPhoto(id, request.photo)
        return ResponseEntity.noContent().build()
    }

    @GetMapping("/{id}/photo")
    @Operation(summary = "Get child photo", security = [SecurityRequirement(name = "bearerAuth")])
    fun getChildPhoto(@PathVariable id: UUID): ResponseEntity<ByteArray> {
        val photo = parentChildService.getChildPhoto(id) ?: return ResponseEntity.notFound().build()
        val (bytes, contentType) = photo
        return ResponseEntity.ok().contentType(MediaType.parseMediaType(contentType)).body(bytes)
    }
}

data class PhotoUploadRequest(
    @field:NotBlank
    val photo: String
)
