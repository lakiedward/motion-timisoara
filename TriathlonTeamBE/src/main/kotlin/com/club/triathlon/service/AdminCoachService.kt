package com.club.triathlon.service

import com.club.triathlon.domain.CoachProfile
import com.club.triathlon.domain.User
import com.club.triathlon.enums.Role
import com.club.triathlon.repo.CoachInvitationCodeRepository
import com.club.triathlon.repo.CoachProfileRepository
import com.club.triathlon.repo.CourseRepository
import com.club.triathlon.repo.SportRepository
import com.club.triathlon.repo.UserRepository
import com.club.triathlon.service.storage.StorageService
import com.club.triathlon.util.PhotoUtils
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.http.HttpStatus
import org.springframework.http.MediaType
import org.springframework.http.ResponseEntity
import org.springframework.security.crypto.password.PasswordEncoder
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.server.ResponseStatusException
import jakarta.validation.constraints.Email
import jakarta.validation.constraints.NotBlank
import java.net.URI
import java.time.OffsetDateTime
import java.util.UUID

@Service
class AdminCoachService(
    private val userRepository: UserRepository,
    private val coachProfileRepository: CoachProfileRepository,
    private val courseRepository: CourseRepository,
    private val sportRepository: SportRepository,
    private val passwordEncoder: PasswordEncoder,
    private val invitationCodeRepository: CoachInvitationCodeRepository,
    private val stripeConnectService: StripeConnectService
) {

    @Autowired(required = false)
    private var storageService: StorageService? = null

    @Transactional
    fun inviteCoach(request: CoachInviteRequest): CoachInviteResponse {
        if (userRepository.existsByEmail(request.email)) {
            throw ResponseStatusException(HttpStatus.CONFLICT, "Email already registered")
        }

        val user = User().apply {
            email = request.email
            passwordHash = passwordEncoder.encode(request.password)
            name = request.name
            phone = request.phone
            role = Role.COACH
            createdAt = OffsetDateTime.now()
            enabled = true
        }
        val savedUser = userRepository.save(user)

        // Resolve sports from IDs
        val sports = if (request.sportIds.isNullOrEmpty()) {
            mutableSetOf()
        } else {
            sportRepository.findAllById(request.sportIds).toMutableSet()
        }

        val coachProfile = CoachProfile().apply {
            this.user = savedUser
            bio = request.bio
            this.sports = sports
            
            // Process photo if provided (S3 upload happens after save to get ID)
            request.photo?.let { base64Photo ->
                val photoData = PhotoUtils.processPhoto(base64Photo)
                this.photoContentType = photoData.second
                if (storageService == null) {
                    this.photo = photoData.first
                }
            }
        }
        val savedProfile = coachProfileRepository.save(coachProfile)
        // Upload to S3 after save (need profile ID)
        request.photo?.let { base64Photo ->
            storageService?.let { storage ->
                val photoData = PhotoUtils.processPhoto(base64Photo)
                val key = storage.generateObjectKey("coaches/${savedProfile.id}", photoData.second)
                storage.upload(key, photoData.first, photoData.second)
                savedProfile.photoS3Key = key
                coachProfileRepository.save(savedProfile)
            }
        }

        return CoachInviteResponse(
            coachId = savedUser.id!!
        )
    }

    @Transactional(readOnly = true)
    fun listCoaches(): List<CoachDto> {
        val users = userRepository.findAllByRole(Role.COACH)
        if (users.isEmpty()) return emptyList()

        val profiles = coachProfileRepository.findByUserIn(users)
        val profileByUserId = profiles.associateBy { it.user.id }

        val courses = courseRepository.findByCoachIn(users)
        val coursesByCoachId = courses.groupBy { it.coach.id!! }

        val courseCountByCoachId = coursesByCoachId.mapValues { it.value.size }
        val citiesByCoachId = coursesByCoachId.mapValues { (_, coachCourses) ->
            coachCourses
                .mapNotNull { it.location.city?.trim() }
                .filter { it.isNotBlank() }
                .distinct()
                .sorted()
        }

        return users.map { user ->
            val userId = user.id!!
            val profile = profileByUserId[user.id]
            val sports = profile?.sports?.map { sport ->
                SportDto(
                    id = sport.id!!,
                    code = sport.code,
                    name = sport.name
                )
            } ?: emptyList()

            CoachDto(
                id = userId,
                name = user.name,
                email = user.email,
                phone = user.phone,
                enabled = user.enabled,
                bio = profile?.bio,
                sports = sports,
                cities = citiesByCoachId[userId] ?: emptyList(),
                courseCount = courseCountByCoachId[userId] ?: 0,
                hasPhoto = profile?.photoS3Key != null || profile?.photo != null
            )
        }
    }

    @Transactional(readOnly = true)
    fun getCoachById(id: UUID): CoachDto {
        val user = userRepository.findById(id).orElseThrow {
            ResponseStatusException(HttpStatus.NOT_FOUND, "Coach not found")
        }
        if (user.role != Role.COACH) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "User is not a coach")
        }

        val profile = coachProfileRepository.findByUser(user)
        val sports = profile?.sports?.map { sport ->
            SportDto(
                id = sport.id!!,
                code = sport.code,
                name = sport.name
            )
        } ?: emptyList()

        val courses = courseRepository.findByCoach(user)
        val courseCount = courses.size
        val cities = courses
            .mapNotNull { it.location.city?.trim() }
            .filter { it.isNotBlank() }
            .distinct()
            .sorted()

        return CoachDto(
            id = user.id!!,
            name = user.name,
            email = user.email,
            phone = user.phone,
            enabled = user.enabled,
            bio = profile?.bio,
            sports = sports,
            cities = cities,
            courseCount = courseCount,
            hasPhoto = profile?.photoS3Key != null || profile?.photo != null
        )
    }

    @Transactional
    fun updateStatus(id: UUID, active: Boolean) {
        val user = userRepository.findById(id).orElseThrow {
            ResponseStatusException(HttpStatus.NOT_FOUND, "Coach not found")
        }
        if (user.role != Role.COACH) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "User is not a coach")
        }
        user.enabled = active
        userRepository.save(user)
    }

    @Transactional
    fun updateCoach(id: UUID, request: CoachUpdateRequest): CoachDto {
        val user = userRepository.findById(id).orElseThrow {
            ResponseStatusException(HttpStatus.NOT_FOUND, "Coach not found")
        }
        if (user.role != Role.COACH) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "User is not a coach")
        }

        // Check if email is being changed and if it's already taken
        if (!request.email.isNullOrBlank() && request.email != user.email) {
            if (userRepository.existsByEmail(request.email)) {
                throw ResponseStatusException(HttpStatus.CONFLICT, "Email already in use")
            }
            user.email = request.email
        }

        // Update user fields
        user.name = request.name
        user.phone = request.phone
        
        // Update password if provided
        if (!request.password.isNullOrBlank()) {
            user.passwordHash = passwordEncoder.encode(request.password)
        }
        
        val updatedUser = userRepository.save(user)

        // Update or create coach profile
        val profile = coachProfileRepository.findByUser(updatedUser) ?: CoachProfile().apply {
            this.user = updatedUser
        }
        profile.bio = request.bio
        
        // Update photo if provided
        request.photo?.let { base64Photo ->
            val photoData = PhotoUtils.processPhoto(base64Photo)
            profile.photoContentType = photoData.second
            // Delete old S3 photo if exists
            profile.photoS3Key?.let { oldKey -> storageService?.delete(oldKey) }
            storageService?.let { storage ->
                val key = storage.generateObjectKey("coaches/${profile.id}", photoData.second)
                storage.upload(key, photoData.first, photoData.second)
                profile.photoS3Key = key
                profile.photo = null
            } ?: run {
                profile.photo = photoData.first
            }
        }
        
        // Update sports
        profile.sports.clear()
        if (!request.sportIds.isNullOrEmpty()) {
            val sports = sportRepository.findAllById(request.sportIds)
            profile.sports.addAll(sports)
        }
        
        coachProfileRepository.save(profile)

        val courses = courseRepository.findByCoach(updatedUser)
        val courseCount = courses.size
        val cities = courses
            .mapNotNull { it.location.city?.trim() }
            .filter { it.isNotBlank() }
            .distinct()
            .sorted()

        val sportDtos = profile.sports.map { sport ->
            SportDto(
                id = sport.id!!,
                code = sport.code,
                name = sport.name
            )
        }

        return CoachDto(
            id = updatedUser.id!!,
            name = updatedUser.name,
            email = updatedUser.email,
            phone = updatedUser.phone,
            enabled = updatedUser.enabled,
            bio = profile.bio,
            sports = sportDtos,
            cities = cities,
            courseCount = courseCount,
            hasPhoto = profile.photoS3Key != null || profile.photo != null
        )
    }

    @Transactional
    fun deleteCoach(id: UUID) {
        val user = userRepository.findById(id).orElseThrow {
            ResponseStatusException(HttpStatus.NOT_FOUND, "Coach not found")
        }
        if (user.role != Role.COACH) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "User is not a coach")
        }

        // Verifică dacă are cursuri active
        val activeCourses = courseRepository.findByCoach(user).filter { it.active }
        if (activeCourses.isNotEmpty()) {
            throw ResponseStatusException(
                HttpStatus.CONFLICT,
                "Cannot delete coach with ${activeCourses.size} active courses"
            )
        }

        // Șterge toate cursurile inactive ale coach-ului
        courseRepository.deleteAll(courseRepository.findByCoach(user))

        // Anulează referința din codul de invitație (FK constraint)
        invitationCodeRepository.findByUsedByUser(user)?.let { code ->
            code.usedByUser = null
            invitationCodeRepository.save(code)
        }

        // Șterge contul Stripe Connect (dacă există)
        coachProfileRepository.findByUser(user)?.let { profile ->
            profile.stripeAccountId?.let { stripeAccountId ->
                stripeConnectService.deleteAccount(stripeAccountId)
            }
            coachProfileRepository.delete(profile)
        }

        // Șterge user-ul
        userRepository.delete(user)
    }

    @Transactional(readOnly = true)
    fun getCoachPhoto(id: UUID): ResponseEntity<ByteArray> {
        val user = userRepository.findById(id).orElseThrow {
            ResponseStatusException(HttpStatus.NOT_FOUND, "Coach not found")
        }
        if (user.role != Role.COACH) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "User is not a coach")
        }

        val profile = coachProfileRepository.findByUser(user)
            ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "Coach profile not found")

        // If S3 key exists, redirect to presigned URL
        profile.photoS3Key?.let { key ->
            storageService?.let { storage ->
                val presignedUrl = storage.generatePresignedUrl(key)
                return ResponseEntity.status(HttpStatus.FOUND)
                    .location(URI.create(presignedUrl))
                    .build()
            }
        }

        if (profile.photo == null) {
            throw ResponseStatusException(HttpStatus.NOT_FOUND, "Coach has no photo")
        }

        val contentType = profile.photoContentType?.let { MediaType.parseMediaType(it) }
            ?: MediaType.IMAGE_JPEG

        return ResponseEntity.ok()
            .contentType(contentType)
            .body(profile.photo)
    }

}

data class CoachInviteRequest(
    @field:NotBlank
    val name: String,
    @field:NotBlank
    @field:Email
    val email: String,
    @field:NotBlank
    val password: String,
    val phone: String?,
    val bio: String?,
    val sportIds: List<UUID>?,
    val photo: String?
)

data class CoachInviteResponse(
    val coachId: UUID
)

data class CoachUpdateRequest(
    @field:NotBlank
    val name: String,
    @field:Email
    val email: String?,
    val password: String?,
    val phone: String?,
    val bio: String?,
    val sportIds: List<UUID>?,
    val photo: String?
)

data class CoachDto(
    val id: UUID,
    val name: String,
    val email: String,
    val phone: String?,
    val enabled: Boolean,
    val bio: String?,
    val sports: List<SportDto>,
    val cities: List<String> = emptyList(),
    val courseCount: Int,
    val hasPhoto: Boolean = false
)






