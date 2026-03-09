package com.club.triathlon.service.parent

import com.club.triathlon.domain.Child
import com.club.triathlon.domain.User
import com.club.triathlon.enums.AttendanceStatus
import com.club.triathlon.enums.EnrollmentStatus
import com.club.triathlon.repo.AttendanceRepository
import com.club.triathlon.repo.ChildRepository
import com.club.triathlon.repo.EnrollmentRepository
import com.club.triathlon.repo.PaymentRepository
import com.club.triathlon.security.UserPrincipal
import com.club.triathlon.util.PhotoUtils
import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.NotNull
import jakarta.validation.constraints.Pattern
import org.springframework.http.HttpStatus
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.server.ResponseStatusException
import java.time.LocalDate
import java.time.OffsetDateTime
import java.util.UUID

@Service
class ParentChildService(
    private val childRepository: ChildRepository,
    private val enrollmentRepository: EnrollmentRepository,
    private val paymentRepository: PaymentRepository,
    private val attendanceRepository: AttendanceRepository
) {

    @Transactional(readOnly = true)
    fun listChildren(): List<ChildDto> {
        val parent = currentParent()
        return childRepository.findAllByParent(parent).map { it.toDto() }
    }

    @Transactional(readOnly = true)
    fun getChild(id: UUID): ChildDto {
        val parent = currentParent()
        val child = childRepository.findById(id).orElseThrow {
            ResponseStatusException(HttpStatus.NOT_FOUND, "Child not found")
        }
        if (child.parent.id != parent.id) {
            throw ResponseStatusException(HttpStatus.FORBIDDEN, "Child does not belong to parent")
        }
        return child.toDto()
    }

    @Transactional
    fun createChild(request: ChildRequest): ChildDto {
        val parent = currentParent()
        val child = Child().apply {
            this.parent = parent
            name = request.name.trim()
            birthDate = request.birthDate
            level = request.level?.trim().takeUnless { it.isNullOrBlank() }
            allergies = request.allergies?.trim().takeUnless { it.isNullOrBlank() }
            emergencyContactName = request.emergencyContactName?.trim().takeUnless { it.isNullOrBlank() }
            emergencyPhone = request.emergencyPhone.trim()
            secondaryContactName = request.secondaryContactName?.trim().takeUnless { it.isNullOrBlank() }
            secondaryPhone = request.secondaryPhone?.trim().takeUnless { it.isNullOrBlank() }
            tshirtSize = request.tshirtSize?.trim().takeUnless { it.isNullOrBlank() }
            gdprConsentAt = parent.gdprConsentTimestamp()
        }
        val saved = childRepository.save(child)
        return saved.toDto()
    }

    @Transactional
    fun updateChild(id: UUID, request: ChildRequest): ChildDto {
        val parent = currentParent()
        val child = childRepository.findById(id).orElseThrow {
            ResponseStatusException(HttpStatus.NOT_FOUND, "Child not found")
        }
        if (child.parent.id != parent.id) {
            throw ResponseStatusException(HttpStatus.FORBIDDEN, "Child does not belong to parent")
        }
        child.name = request.name.trim()
        child.birthDate = request.birthDate
        child.level = request.level?.trim().takeUnless { it.isNullOrBlank() }
        child.allergies = request.allergies?.trim().takeUnless { it.isNullOrBlank() }
        child.emergencyContactName = request.emergencyContactName?.trim().takeUnless { it.isNullOrBlank() }
        child.emergencyPhone = request.emergencyPhone.trim()
        child.secondaryContactName = request.secondaryContactName?.trim().takeUnless { it.isNullOrBlank() }
        child.secondaryPhone = request.secondaryPhone?.trim().takeUnless { it.isNullOrBlank() }
        child.tshirtSize = request.tshirtSize?.trim().takeUnless { it.isNullOrBlank() }
        child.gdprConsentAt = child.gdprConsentAt ?: parent.gdprConsentTimestamp()
        val saved = childRepository.save(child)
        return saved.toDto()
    }

    @Transactional
    fun deleteChild(id: UUID) {
        val parent = currentParent()
        val child = childRepository.findById(id).orElseThrow {
            ResponseStatusException(HttpStatus.NOT_FOUND, "Child not found")
        }
        if (child.parent.id != parent.id) {
            throw ResponseStatusException(HttpStatus.FORBIDDEN, "Child does not belong to parent")
        }
        
        // CASCADE DELETE - șterge toate datele asociate copilului
        // 1. Get all enrollments (any status)
        val allEnrollments = enrollmentRepository.findByChildAndStatusIn(
            child, 
            EnrollmentStatus.values().toList()
        )
        
        // 2. Delete payments (foreign key constraint - must delete first)
        allEnrollments.forEach { enrollment ->
            val payments = paymentRepository.findByEnrollment(enrollment)
            paymentRepository.deleteAll(payments)
        }
        
        // 3. Delete attendances
        val attendances = attendanceRepository.findByChild(child)
        attendanceRepository.deleteAll(attendances)
        
        // 4. Delete enrollments
        enrollmentRepository.deleteAll(allEnrollments)
        
        // 5. Finally, delete the child
        childRepository.delete(child)
    }

    @Transactional(readOnly = true)
    fun getChildAttendance(childId: UUID): ParentAttendanceDto {
        val parent = currentParent()
        val child = childRepository.findById(childId).orElseThrow {
            ResponseStatusException(HttpStatus.NOT_FOUND, "Child not found")
        }
        if (child.parent.id != parent.id) {
            throw ResponseStatusException(HttpStatus.FORBIDDEN, "Child does not belong to parent")
        }
        
        // Get all attendance records for this child
        val attendanceRecords = attendanceRepository.findByChild(child)
        
        // Group by course
        val byCourse = attendanceRecords.groupBy { it.occurrence.course }
        
        val courses = byCourse.map { (course, attendances) ->
            val sessions = attendances
                .sortedByDescending { it.occurrence.startsAt }
                .map { attendance ->
                    AttendanceSessionDto(
                        id = attendance.id!!,
                        date = attendance.occurrence.startsAt,
                        status = attendance.status.name.lowercase(),
                        statusLabel = when(attendance.status) {
                            AttendanceStatus.PRESENT -> "Prezent"
                            AttendanceStatus.ABSENT -> "Absent"
                        },
                        note = attendance.note
                    )
                }
            
            AttendanceCourseDto(
                id = course.id!!,
                name = course.name,
                sessions = sessions
            )
        }
        
        return ParentAttendanceDto(courses = courses)
    }

    private fun Child.toDto() =  ChildDto(
        id = this.id!!,
        name = this.name,
        birthDate = this.birthDate,
        level = this.level,
        allergies = this.allergies,
        emergencyContactName = this.emergencyContactName,
        emergencyPhone = this.emergencyPhone,
        gdprConsentAt = this.gdprConsentAt,
        secondaryContactName = this.secondaryContactName,
        secondaryPhone = this.secondaryPhone,
        tshirtSize = this.tshirtSize,
        hasPhoto = this.photo != null
    )

    private fun currentParent(): User {
        val authentication = org.springframework.security.core.context.SecurityContextHolder.getContext().authentication
        val principal = authentication?.principal
        if (principal is UserPrincipal) {
            val user = principal.user
            if (user.role != com.club.triathlon.enums.Role.PARENT) {
                throw ResponseStatusException(HttpStatus.FORBIDDEN, "Only parents can manage children")
            }
            return user
        }
        throw ResponseStatusException(HttpStatus.UNAUTHORIZED, "Unauthenticated")
    }

    private fun User.gdprConsentTimestamp(): OffsetDateTime = OffsetDateTime.now()

    // Photo operations
    @Transactional
    fun saveChildPhoto(id: UUID, base64: String) {
        val parent = currentParent()
        val child = childRepository.findById(id).orElseThrow {
            ResponseStatusException(HttpStatus.NOT_FOUND, "Child not found")
        }
        if (child.parent.id != parent.id) {
            throw ResponseStatusException(HttpStatus.FORBIDDEN, "Child does not belong to parent")
        }
        val (bytes, contentType) = PhotoUtils.processPhoto(base64)
        child.photo = bytes
        child.photoContentType = contentType
        childRepository.save(child)
    }

    @Transactional(readOnly = true)
    fun getChildPhoto(id: UUID): Pair<ByteArray, String>? {
        val parent = currentParent()
        val child = childRepository.findById(id).orElseThrow {
            ResponseStatusException(HttpStatus.NOT_FOUND, "Child not found")
        }
        if (child.parent.id != parent.id) {
            throw ResponseStatusException(HttpStatus.FORBIDDEN, "Child does not belong to parent")
        }
        val bytes = child.photo ?: return null
        val contentType = child.photoContentType ?: "image/jpeg"
        return bytes to contentType
    }
}

data class ChildDto(
    val id: UUID,
    val name: String,
    val birthDate: LocalDate,
    val level: String?,
    val allergies: String?,
    val emergencyContactName: String?,
    val emergencyPhone: String?,
    val gdprConsentAt: OffsetDateTime?,
    val secondaryContactName: String?,
    val secondaryPhone: String?,
    val tshirtSize: String?,
    val hasPhoto: Boolean
)

data class ChildRequest(
    @field:NotBlank
    val name: String,
    @field:NotNull
    val birthDate: LocalDate,
    val level: String?,
    val allergies: String?,
    val emergencyContactName: String?,
    @field:NotBlank
    @field:Pattern(regexp = "^[0-9+ ]{6,20}$")
    val emergencyPhone: String,
    val secondaryContactName: String?,
    val secondaryPhone: String?,
    val tshirtSize: String?,
    val gdprConsent: Boolean? = null
)

data class ParentAttendanceDto(
    val courses: List<AttendanceCourseDto>
)

data class AttendanceCourseDto(
    val id: UUID,
    val name: String,
    val sessions: List<AttendanceSessionDto>
)

data class AttendanceSessionDto(
    val id: UUID,
    val date: OffsetDateTime,
    val status: String,
    val statusLabel: String,
    val note: String?
)
