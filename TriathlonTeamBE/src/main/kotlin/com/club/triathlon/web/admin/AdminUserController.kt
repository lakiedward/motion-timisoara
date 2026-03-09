package com.club.triathlon.web.admin

import com.club.triathlon.service.AdminUserService
import com.club.triathlon.service.parent.ChildRequest
import org.springframework.http.HttpStatus
import org.springframework.http.MediaType
import org.springframework.http.ResponseEntity
import org.springframework.security.access.prepost.PreAuthorize
import org.springframework.web.bind.annotation.*
import jakarta.validation.Valid
import java.util.UUID

@RestController
@RequestMapping("/api/admin/users")
@PreAuthorize("hasRole('ADMIN')")
class AdminUserController(
    private val adminUserService: AdminUserService
) {

    @GetMapping
    fun getAllUsers(): List<AdminUserDto> = adminUserService.getAllUsers()

    @GetMapping("/{id}")
    fun getUser(@PathVariable id: UUID): AdminUserDto = adminUserService.getUser(id)

    @PutMapping("/{id}")
    fun updateUser(
        @PathVariable id: UUID,
        @RequestBody request: UpdateUserRequest
    ): AdminUserDto = adminUserService.updateUser(id, request)

    @PatchMapping("/{id}/status")
    fun setUserStatus(
        @PathVariable id: UUID,
        @RequestParam active: Boolean
    ): AdminUserDto = adminUserService.setUserStatus(id, active)

    @PatchMapping("/{id}/role")
    fun setUserRole(
        @PathVariable id: UUID,
        @RequestParam role: String
    ): AdminUserDto = adminUserService.setUserRole(id, role)

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun deleteUser(
        @PathVariable id: UUID,
        @RequestParam(defaultValue = "false") force: Boolean
    ) = adminUserService.deleteUser(id, force)

    // ========== CHILDREN MANAGEMENT ==========

    @GetMapping("/{userId}/children")
    fun getUserChildren(@PathVariable userId: UUID): List<AdminChildDto> =
        adminUserService.getUserChildren(userId)

    @GetMapping("/{userId}/children/{childId}")
    fun getUserChild(
        @PathVariable userId: UUID,
        @PathVariable childId: UUID
    ): AdminChildDto = adminUserService.getUserChild(userId, childId)

    @PostMapping("/{userId}/children")
    fun createUserChild(
        @PathVariable userId: UUID,
        @Valid @RequestBody request: ChildRequest
    ): AdminChildDto = adminUserService.createUserChild(userId, request)

    @PutMapping("/{userId}/children/{childId}")
    fun updateUserChild(
        @PathVariable userId: UUID,
        @PathVariable childId: UUID,
        @Valid @RequestBody request: ChildRequest
    ): AdminChildDto = adminUserService.updateUserChild(userId, childId, request)

    @DeleteMapping("/{userId}/children/{childId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun deleteUserChild(
        @PathVariable userId: UUID,
        @PathVariable childId: UUID,
        @RequestParam(defaultValue = "false") force: Boolean
    ) = adminUserService.deleteUserChild(userId, childId, force)

    @GetMapping("/{userId}/children/{childId}/photo")
    fun getChildPhoto(
        @PathVariable userId: UUID,
        @PathVariable childId: UUID
    ): ResponseEntity<ByteArray> {
        val photo = adminUserService.getChildPhoto(userId, childId)
            ?: return ResponseEntity.notFound().build()
        val (bytes, contentType) = photo
        return ResponseEntity.ok().contentType(MediaType.parseMediaType(contentType)).body(bytes)
    }

    @PostMapping("/{userId}/children/{childId}/photo")
    fun uploadChildPhoto(
        @PathVariable userId: UUID,
        @PathVariable childId: UUID,
        @Valid @RequestBody request: AdminPhotoUploadRequest
    ): ResponseEntity<Void> {
        adminUserService.saveChildPhoto(userId, childId, request.photo)
        return ResponseEntity.noContent().build()
    }
}

data class AdminUserDto(
    val id: UUID,
    val email: String,
    val name: String,
    val phone: String?,
    val role: String,
    val enabled: Boolean,
    val createdAt: String,
    val oauthProvider: String?,
    val avatarUrl: String?,
    val childrenCount: Int,
    val enrollmentsCount: Int,
    val clubId: UUID? = null
)

data class UpdateUserRequest(
    val name: String?,
    val email: String?,
    val phone: String?,
    val role: String?
)

data class AdminChildDto(
    val id: UUID,
    val name: String,
    val birthDate: String,
    val level: String?,
    val allergies: String?,
    val emergencyContactName: String?,
    val emergencyPhone: String?,
    val secondaryContactName: String?,
    val secondaryPhone: String?,
    val tshirtSize: String?,
    val hasPhoto: Boolean,
    val enrollmentsCount: Int
)

data class AdminPhotoUploadRequest(
    val photo: String
)
