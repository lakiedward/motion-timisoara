package com.club.triathlon.service.enrollment

import com.club.triathlon.domain.Child
import com.club.triathlon.domain.Course
import com.club.triathlon.domain.CourseOccurrence
import com.club.triathlon.enums.EnrollmentKind
import com.club.triathlon.enums.EnrollmentStatus
import com.club.triathlon.repo.ChildRepository
import com.club.triathlon.repo.CourseOccurrenceRepository
import com.club.triathlon.repo.CourseRepository
import com.club.triathlon.repo.EnrollmentRepository
import org.springframework.http.HttpStatus
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.server.ResponseStatusException
import java.time.LocalDate
import java.time.Period
import java.util.UUID

@Service
class EnrollmentValidationService(
    private val childRepository: ChildRepository,
    private val courseRepository: CourseRepository,
    private val enrollmentRepository: EnrollmentRepository,
    private val courseOccurrenceRepository: CourseOccurrenceRepository
) {

    @Transactional(readOnly = true)
    fun validateChildren(courseId: UUID, childIds: List<UUID>, parentId: UUID): List<ChildValidationResult> {
        val course = courseRepository.findById(courseId).orElseThrow {
            ResponseStatusException(HttpStatus.NOT_FOUND, "Course not found")
        }

        return childIds.map { childId ->
            val child = childRepository.findById(childId).orElse(null)
            
            if (child == null || child.parent.id != parentId) {
                ChildValidationResult(
                    childId = childId,
                    childName = "Unknown",
                    isValid = false,
                    ageValid = false,
                    ageMessage = "Copilul nu a fost găsit",
                    scheduleConflicts = emptyList()
                )
            } else {
                validateChild(child, course)
            }
        }
    }

    private fun validateChild(child: Child, course: Course): ChildValidationResult {
        val ageValidation = validateAge(child, course)
        val conflicts = checkScheduleConflicts(child, course)
        
        return ChildValidationResult(
            childId = child.id!!,
            childName = child.name,
            isValid = ageValidation.isValid,
            ageValid = ageValidation.isValid,
            ageMessage = ageValidation.message,
            scheduleConflicts = conflicts
        )
    }

    private fun validateAge(child: Child, course: Course): AgeValidation {
        val age = Period.between(child.birthDate, LocalDate.now()).years

        val ageMin = course.ageFrom
        val ageMax = course.ageTo

        return when {
            ageMin == null && ageMax == null -> AgeValidation(true, null)
            ageMin != null && ageMax != null -> {
                if (age in ageMin..ageMax) {
                    AgeValidation(true, null)
                } else {
                    AgeValidation(false, "Vârsta copilului ($age ani) nu corespunde cerinței cursului ($ageMin-$ageMax ani)")
                }
            }
            ageMin != null -> {
                if (age >= ageMin) {
                    AgeValidation(true, null)
                } else {
                    AgeValidation(false, "Vârsta minimă pentru acest curs este $ageMin ani (copilul are $age ani)")
                }
            }
            ageMax != null -> {
                if (age <= ageMax) {
                    AgeValidation(true, null)
                } else {
                    AgeValidation(false, "Vârsta maximă pentru acest curs este $ageMax ani (copilul are $age ani)")
                }
            }
            else -> AgeValidation(true, null)
        }
    }

    private fun checkScheduleConflicts(child: Child, newCourse: Course): List<ScheduleConflict> {
        val activeEnrollments = enrollmentRepository.findByChildAndStatusIn(
            child,
            listOf(EnrollmentStatus.ACTIVE, EnrollmentStatus.PENDING)
        )

        val enrolledCourses = activeEnrollments
            .filter { it.kind == EnrollmentKind.COURSE }
            .mapNotNull { 
                try {
                    courseRepository.findById(it.entityId).orElse(null)
                } catch (e: Exception) {
                    null
                }
            }

        if (enrolledCourses.isEmpty()) {
            return emptyList()
        }

        val newOccurrences = courseOccurrenceRepository.findAllByCourse(newCourse)
        val conflicts = mutableListOf<ScheduleConflict>()

        enrolledCourses.forEach { existingCourse ->
            val existingOccurrences = courseOccurrenceRepository.findAllByCourse(existingCourse)

            existingOccurrences.forEach { existing ->
                newOccurrences.forEach { new ->
                    if (occurrencesOverlap(existing, new)) {
                        conflicts.add(
                            ScheduleConflict(
                                conflictingCourseId = existingCourse.id!!,
                                conflictingCourseName = existingCourse.name,
                                dayOfWeek = getDayOfWeekRomanian(existing.startsAt.dayOfWeek.value),
                                timeRange = "${existing.startsAt.toLocalTime()} - ${existing.endsAt.toLocalTime()}"
                            )
                        )
                    }
                }
            }
        }

        return conflicts.distinctBy { it.conflictingCourseId }
    }

    private fun occurrencesOverlap(occ1: CourseOccurrence, occ2: CourseOccurrence): Boolean {
        return !(occ1.endsAt <= occ2.startsAt || occ1.startsAt >= occ2.endsAt)
    }

    private fun getDayOfWeekRomanian(dayOfWeek: Int): String {
        return when (dayOfWeek) {
            1 -> "Luni"
            2 -> "Marți"
            3 -> "Miercuri"
            4 -> "Joi"
            5 -> "Vineri"
            6 -> "Sâmbătă"
            7 -> "Duminică"
            else -> "Unknown"
        }
    }
}

private data class AgeValidation(
    val isValid: Boolean,
    val message: String?
)

data class ChildValidationResult(
    val childId: UUID,
    val childName: String,
    val isValid: Boolean,
    val ageValid: Boolean,
    val ageMessage: String?,
    val scheduleConflicts: List<ScheduleConflict>
)

data class ScheduleConflict(
    val conflictingCourseId: UUID,
    val conflictingCourseName: String,
    val dayOfWeek: String,
    val timeRange: String
)

