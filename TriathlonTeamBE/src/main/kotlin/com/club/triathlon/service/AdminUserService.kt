package com.club.triathlon.service

import com.club.triathlon.domain.User
import com.club.triathlon.enums.Role
import com.club.triathlon.repo.AttendanceRepository
import com.club.triathlon.repo.ActivityRepository
import com.club.triathlon.repo.ChildRepository
import com.club.triathlon.repo.ClubInvitationCodeRepository
import com.club.triathlon.repo.ClubRepository
import com.club.triathlon.repo.CoachInvitationCodeRepository
import com.club.triathlon.repo.CoachProfileRepository
import com.club.triathlon.repo.CoachRatingRepository
import com.club.triathlon.repo.CourseRepository
import com.club.triathlon.repo.EnrollmentRepository
import com.club.triathlon.repo.InvoiceRepository
import com.club.triathlon.repo.MonthlyPaymentRepository
import com.club.triathlon.repo.PasswordResetTokenRepository
import com.club.triathlon.repo.PaymentRepository
import com.club.triathlon.repo.RefreshTokenRepository
import com.club.triathlon.repo.UserRecentLocationRepository
import com.club.triathlon.repo.UserRepository
import org.slf4j.LoggerFactory
import com.club.triathlon.web.admin.AdminUserDto
import com.club.triathlon.web.admin.AdminChildDto
import com.club.triathlon.web.admin.UpdateUserRequest
import com.club.triathlon.service.parent.ChildRequest
import com.club.triathlon.util.PhotoUtils
import org.springframework.http.HttpStatus
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.server.ResponseStatusException
import java.time.format.DateTimeFormatter
import java.util.UUID

@Service
class AdminUserService(
    private val userRepository: UserRepository,
    private val childRepository: ChildRepository,
    private val enrollmentRepository: EnrollmentRepository,
    private val paymentRepository: PaymentRepository,
    private val invoiceRepository: InvoiceRepository,
    private val monthlyPaymentRepository: MonthlyPaymentRepository,
    private val userRecentLocationRepository: UserRecentLocationRepository,
    private val attendanceRepository: AttendanceRepository,
    private val refreshTokenRepository: RefreshTokenRepository,
    private val passwordResetTokenRepository: PasswordResetTokenRepository,
    private val coachProfileRepository: CoachProfileRepository,
    private val courseRepository: CourseRepository,
    private val activityRepository: ActivityRepository,
    private val coachInvitationCodeRepository: CoachInvitationCodeRepository,
    private val clubInvitationCodeRepository: ClubInvitationCodeRepository,
    private val clubRepository: ClubRepository,
    private val coachRatingRepository: CoachRatingRepository,
    private val adminCourseService: AdminCourseService,
    private val adminActivityService: AdminActivityService,
    private val stripeConnectService: StripeConnectService,
    private val adminClubService: AdminClubService
) {

    private val logger = LoggerFactory.getLogger(AdminUserService::class.java)

    fun getAllUsers(): List<AdminUserDto> {
        return userRepository.findAll()
            .map { toDto(it) }
            .sortedByDescending { it.createdAt }
    }

    fun getUser(id: UUID): AdminUserDto {
        val user = userRepository.findById(id).orElseThrow {
            ResponseStatusException(HttpStatus.NOT_FOUND, "Utilizatorul nu a fost găsit")
        }
        return toDto(user)
    }

    @Transactional
    fun updateUser(id: UUID, request: UpdateUserRequest): AdminUserDto {
        val user = userRepository.findById(id).orElseThrow {
            ResponseStatusException(HttpStatus.NOT_FOUND, "Utilizatorul nu a fost găsit")
        }

        request.name?.let { user.name = it }
        request.email?.let { 
            if (userRepository.existsByEmail(it) && user.email != it) {
                throw ResponseStatusException(HttpStatus.CONFLICT, "Email-ul este deja folosit")
            }
            user.email = it 
        }
        request.phone?.let { user.phone = it }
        request.role?.let { 
            try {
                user.role = Role.valueOf(it.uppercase())
            } catch (e: IllegalArgumentException) {
                throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Rol invalid: $it")
            }
        }

        return toDto(userRepository.save(user))
    }

    @Transactional
    fun setUserStatus(id: UUID, active: Boolean): AdminUserDto {
        val user = userRepository.findById(id).orElseThrow {
            ResponseStatusException(HttpStatus.NOT_FOUND, "Utilizatorul nu a fost găsit")
        }

        // Prevent disabling yourself or other admins
        if (!active && user.role == Role.ADMIN) {
            throw ResponseStatusException(HttpStatus.FORBIDDEN, "Nu poți dezactiva un administrator")
        }

        user.enabled = active
        return toDto(userRepository.save(user))
    }

    @Transactional
    fun setUserRole(id: UUID, role: String): AdminUserDto {
        val user = userRepository.findById(id).orElseThrow {
            ResponseStatusException(HttpStatus.NOT_FOUND, "Utilizatorul nu a fost găsit")
        }

        try {
            user.role = Role.valueOf(role.uppercase())
        } catch (e: IllegalArgumentException) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Rol invalid: $role")
        }

        return toDto(userRepository.save(user))
    }

    @Transactional
    fun deleteUser(id: UUID, force: Boolean) {
        val user = userRepository.findById(id).orElseThrow {
            ResponseStatusException(HttpStatus.NOT_FOUND, "Utilizatorul nu a fost găsit")
        }

        logger.info("Attempting to delete user: ${user.email}, role: ${user.role}, force: $force")

        // Prevent deleting admins
        if (user.role == Role.ADMIN) {
            throw ResponseStatusException(HttpStatus.FORBIDDEN, "Nu poți șterge un administrator")
        }

        if (user.role == Role.CLUB) {
            val club = clubRepository.findByOwner(user)
            if (club != null) {
                adminClubService.deleteClub(club.id!!, force)
            }
        }

        val coachProfile = coachProfileRepository.findByUser(user)

        // Check for COACH-specific constraints
        if (user.role == Role.COACH) {
            val courses = courseRepository.findByCoach(user)
            val activities = activityRepository.findByCoachId(id)

            if (!force && (courses.isNotEmpty() || activities.isNotEmpty())) {
                throw ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Antrenorul are ${courses.size} cursuri și ${activities.size} activități asociate. Folosește force=true pentru ștergere."
                )
            }

            if (force) {
                activities.forEach { activity ->
                    adminActivityService.deleteActivity(activity.id!!, true)
                }
                courses.forEach { course ->
                    adminCourseService.deleteCourse(course.id!!, true)
                }
            }
        }

        val children = childRepository.findAllByParent(user)
        val enrollments = enrollmentRepository.findByParent(user)

        if (!force && (children.isNotEmpty() || enrollments.isNotEmpty())) {
            throw ResponseStatusException(
                HttpStatus.CONFLICT,
                "Utilizatorul are ${children.size} copii și ${enrollments.size} înscrieri. Folosește force=true pentru ștergere."
            )
        }

        // Force delete: delete all related data in correct order
        if (children.isNotEmpty()) {
            // Delete attendances for all children first (FK constraint)
            children.forEach { child ->
                val attendances = attendanceRepository.findByChild(child)
                if (attendances.isNotEmpty()) {
                    attendanceRepository.deleteAll(attendances)
                }
            }

            // Delete payments for enrollments
            val payments = paymentRepository.findByEnrollmentIn(enrollments)
            if (payments.isNotEmpty()) {
                val invoices = payments.mapNotNull { payment -> invoiceRepository.findByPayment(payment) }
                if (invoices.isNotEmpty()) {
                    invoiceRepository.deleteAll(invoices)
                }
                paymentRepository.deleteAll(payments)
            }

            val monthlyPayments = monthlyPaymentRepository.findByEnrollmentIn(enrollments)
            if (monthlyPayments.isNotEmpty()) {
                monthlyPaymentRepository.deleteAll(monthlyPayments)
            }

            // Delete enrollments
            if (enrollments.isNotEmpty()) {
                enrollmentRepository.deleteAll(enrollments)
            }

            // Delete children
            childRepository.deleteAll(children)
        }

        if (user.role == Role.COACH) {
            val coachRatings = coachRatingRepository.findAllByCoachId(id)
            if (coachRatings.isNotEmpty()) {
                coachRatingRepository.deleteAll(coachRatings)
            }

            coachInvitationCodeRepository.findByUsedByUser(user)?.let { code ->
                code.usedByUser = null
                coachInvitationCodeRepository.save(code)
            }

            if (coachProfile != null) {
                coachProfile.stripeAccountId?.let { stripeAccountId ->
                    stripeConnectService.deleteAccount(stripeAccountId)
                }
                val clubs = clubRepository.findByCoachProfileId(coachProfile.id!!)
                if (clubs.isNotEmpty()) {
                    clubs.forEach { it.coaches.remove(coachProfile) }
                    clubRepository.saveAll(clubs)
                }

                val clubCodes = clubInvitationCodeRepository.findByUsedByCoach(coachProfile)
                if (clubCodes.isNotEmpty()) {
                    clubCodes.forEach { it.usedByCoach = null }
                    clubInvitationCodeRepository.saveAll(clubCodes)
                }
            }
        }

        // Delete coach profile if exists
        if (coachProfile != null) {
            coachProfileRepository.delete(coachProfile)
            logger.info("Deleted coach profile for user: ${user.email}")
        }

        // Delete recent locations
        userRecentLocationRepository.deleteByUser(user)

        // Delete auth tokens
        refreshTokenRepository.deleteByUser(user)
        passwordResetTokenRepository.deleteByUser(user)
        logger.info("Deleted auth tokens for user: ${user.email}")

        // Finally delete user
        userRepository.delete(user)
        logger.info("Successfully deleted user: ${user.email}")
    }

    private fun toDto(user: User): AdminUserDto {
        val children = childRepository.findAllByParent(user)
        val enrollments = enrollmentRepository.findByParent(user)
        val clubId = if (user.role == Role.CLUB) {
            clubRepository.findByOwner(user)?.id
        } else null

        return AdminUserDto(
            id = user.id!!,
            email = user.email,
            name = user.name,
            phone = user.phone,
            role = user.role.name,
            enabled = user.enabled,
            createdAt = user.createdAt.format(DateTimeFormatter.ISO_OFFSET_DATE_TIME),
            oauthProvider = user.oauthProvider,
            avatarUrl = user.avatarUrl,
            childrenCount = children.size,
            enrollmentsCount = enrollments.size,
            clubId = clubId
        )
    }

    // ========== CHILDREN MANAGEMENT ==========

    @Transactional(readOnly = true)
    fun getUserChildren(userId: UUID): List<AdminChildDto> {
        val user = userRepository.findById(userId).orElseThrow {
            ResponseStatusException(HttpStatus.NOT_FOUND, "Utilizatorul nu a fost găsit")
        }
        return childRepository.findAllByParent(user).map { toChildDto(it) }
    }

    @Transactional(readOnly = true)
    fun getUserChild(userId: UUID, childId: UUID): AdminChildDto {
        val user = userRepository.findById(userId).orElseThrow {
            ResponseStatusException(HttpStatus.NOT_FOUND, "Utilizatorul nu a fost găsit")
        }
        val child = childRepository.findById(childId).orElseThrow {
            ResponseStatusException(HttpStatus.NOT_FOUND, "Copilul nu a fost găsit")
        }
        if (child.parent.id != user.id) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Copilul nu aparține acestui utilizator")
        }
        return toChildDto(child)
    }

    @Transactional
    fun createUserChild(userId: UUID, request: ChildRequest): AdminChildDto {
        val user = userRepository.findById(userId).orElseThrow {
            ResponseStatusException(HttpStatus.NOT_FOUND, "Utilizatorul nu a fost găsit")
        }
        val child = com.club.triathlon.domain.Child().apply {
            parent = user
            name = request.name.trim()
            birthDate = request.birthDate
            level = request.level?.trim()?.takeIf { it.isNotBlank() }
            allergies = request.allergies?.trim()?.takeIf { it.isNotBlank() }
            emergencyContactName = request.emergencyContactName?.trim()?.takeIf { it.isNotBlank() }
            emergencyPhone = request.emergencyPhone.trim()
            secondaryContactName = request.secondaryContactName?.trim()?.takeIf { it.isNotBlank() }
            secondaryPhone = request.secondaryPhone?.trim()?.takeIf { it.isNotBlank() }
            tshirtSize = request.tshirtSize?.trim()?.takeIf { it.isNotBlank() }
            gdprConsentAt = java.time.OffsetDateTime.now()
        }
        val saved = childRepository.save(child)
        logger.info("Admin created child ${saved.id} for user ${user.email}")
        return toChildDto(saved)
    }

    @Transactional
    fun updateUserChild(userId: UUID, childId: UUID, request: ChildRequest): AdminChildDto {
        val user = userRepository.findById(userId).orElseThrow {
            ResponseStatusException(HttpStatus.NOT_FOUND, "Utilizatorul nu a fost găsit")
        }
        val child = childRepository.findById(childId).orElseThrow {
            ResponseStatusException(HttpStatus.NOT_FOUND, "Copilul nu a fost găsit")
        }
        if (child.parent.id != user.id) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Copilul nu aparține acestui utilizator")
        }
        child.name = request.name.trim()
        child.birthDate = request.birthDate
        child.level = request.level?.trim()?.takeIf { it.isNotBlank() }
        child.allergies = request.allergies?.trim()?.takeIf { it.isNotBlank() }
        child.emergencyContactName = request.emergencyContactName?.trim()?.takeIf { it.isNotBlank() }
        child.emergencyPhone = request.emergencyPhone.trim()
        child.secondaryContactName = request.secondaryContactName?.trim()?.takeIf { it.isNotBlank() }
        child.secondaryPhone = request.secondaryPhone?.trim()?.takeIf { it.isNotBlank() }
        child.tshirtSize = request.tshirtSize?.trim()?.takeIf { it.isNotBlank() }
        val saved = childRepository.save(child)
        logger.info("Admin updated child ${saved.id} for user ${user.email}")
        return toChildDto(saved)
    }

    @Transactional
    fun deleteUserChild(userId: UUID, childId: UUID, force: Boolean) {
        val user = userRepository.findById(userId).orElseThrow {
            ResponseStatusException(HttpStatus.NOT_FOUND, "Utilizatorul nu a fost găsit")
        }
        val child = childRepository.findById(childId).orElseThrow {
            ResponseStatusException(HttpStatus.NOT_FOUND, "Copilul nu a fost găsit")
        }
        if (child.parent.id != user.id) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Copilul nu aparține acestui utilizator")
        }

        val childEnrollments = enrollmentRepository.findByChild(child)
        val childAttendances = attendanceRepository.findByChild(child)

        if (!force && (childEnrollments.isNotEmpty() || childAttendances.isNotEmpty())) {
            throw ResponseStatusException(
                HttpStatus.CONFLICT,
                "Copilul are ${childEnrollments.size} înscrieri și ${childAttendances.size} prezențe. Folosește force=true pentru ștergere."
            )
        }

        // Delete attendances first
        if (childAttendances.isNotEmpty()) {
            attendanceRepository.deleteAll(childAttendances)
        }

        // Delete payments for enrollments
        val payments = paymentRepository.findByEnrollmentIn(childEnrollments)
        if (payments.isNotEmpty()) {
            val invoices = payments.mapNotNull { payment -> invoiceRepository.findByPayment(payment) }
            if (invoices.isNotEmpty()) {
                invoiceRepository.deleteAll(invoices)
            }
            paymentRepository.deleteAll(payments)
        }

        val monthlyPayments = monthlyPaymentRepository.findByEnrollmentIn(childEnrollments)
        if (monthlyPayments.isNotEmpty()) {
            monthlyPaymentRepository.deleteAll(monthlyPayments)
        }

        // Delete enrollments
        if (childEnrollments.isNotEmpty()) {
            enrollmentRepository.deleteAll(childEnrollments)
        }

        // Delete child
        childRepository.delete(child)
        logger.info("Admin deleted child ${childId} for user ${user.email}")
    }

    @Transactional(readOnly = true)
    fun getChildPhoto(userId: UUID, childId: UUID): Pair<ByteArray, String>? {
        val user = userRepository.findById(userId).orElseThrow {
            ResponseStatusException(HttpStatus.NOT_FOUND, "Utilizatorul nu a fost găsit")
        }
        val child = childRepository.findById(childId).orElseThrow {
            ResponseStatusException(HttpStatus.NOT_FOUND, "Copilul nu a fost găsit")
        }
        if (child.parent.id != user.id) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Copilul nu aparține acestui utilizator")
        }
        val bytes = child.photo ?: return null
        val contentType = child.photoContentType ?: "image/jpeg"
        return bytes to contentType
    }

    @Transactional
    fun saveChildPhoto(userId: UUID, childId: UUID, base64: String) {
        val user = userRepository.findById(userId).orElseThrow {
            ResponseStatusException(HttpStatus.NOT_FOUND, "Utilizatorul nu a fost găsit")
        }
        val child = childRepository.findById(childId).orElseThrow {
            ResponseStatusException(HttpStatus.NOT_FOUND, "Copilul nu a fost găsit")
        }
        if (child.parent.id != user.id) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Copilul nu aparține acestui utilizator")
        }
        val (bytes, contentType) = PhotoUtils.processPhoto(base64)
        child.photo = bytes
        child.photoContentType = contentType
        childRepository.save(child)
        logger.info("Admin uploaded photo for child ${childId}")
    }

    private fun toChildDto(child: com.club.triathlon.domain.Child): AdminChildDto {
        val enrollments = enrollmentRepository.findByChild(child)
        return AdminChildDto(
            id = child.id!!,
            name = child.name,
            birthDate = child.birthDate.toString(),
            level = child.level,
            allergies = child.allergies,
            emergencyContactName = child.emergencyContactName,
            emergencyPhone = child.emergencyPhone,
            secondaryContactName = child.secondaryContactName,
            secondaryPhone = child.secondaryPhone,
            tshirtSize = child.tshirtSize,
            hasPhoto = child.photo != null,
            enrollmentsCount = enrollments.size
        )
    }
}
