package com.club.triathlon.service.course

import com.club.triathlon.domain.Course
import com.club.triathlon.domain.Club
import com.club.triathlon.domain.Location
import com.club.triathlon.domain.Sport
import com.club.triathlon.domain.User
import com.club.triathlon.enums.PaymentRecipientType
import com.club.triathlon.enums.Role
import com.club.triathlon.repo.ClubRepository
import com.club.triathlon.repo.CourseRepository
import com.club.triathlon.repo.LocationRepository
import com.club.triathlon.repo.SportRepository
import com.club.triathlon.repo.UserRepository
import org.springframework.http.HttpStatus
import org.springframework.security.core.context.SecurityContextHolder
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.server.ResponseStatusException
import java.time.OffsetDateTime
import java.util.UUID

@Service
class CourseService(
    private val courseRepository: CourseRepository,
    private val userRepository: UserRepository,
    private val locationRepository: LocationRepository,
    private val sportRepository: SportRepository,
    private val clubRepository: ClubRepository,
    private val courseSchedulerService: CourseSchedulerService
) {

    @Transactional
    fun createCourse(request: CourseRequest): CourseResponse {
        val currentUser = currentUser()
        val coach = resolveCoach(request.coachId, currentUser)
        val location = fetchLocation(request.locationId)
        val sport = fetchSportByCode(request.sport)
        // Resolve club if provided
        val club = request.clubId?.let { clubId ->
            clubRepository.findById(clubId).orElseThrow {
                ResponseStatusException(HttpStatus.BAD_REQUEST, "Club not found")
            }
        }
        
        val course = Course().apply {
            name = request.name
            this.sport = sport
            level = request.level
            ageFrom = request.ageFrom
            ageTo = request.ageTo
            this.coach = coach
            this.location = location
            capacity = request.capacity
            price = request.price
            pricePerSession = request.pricePerSession
            packageOptions = request.packageOptions
            recurrenceRule = request.recurrenceRule
            active = request.active
            description = request.description
            
            // Club and payment settings
            this.club = club
            this.paymentRecipient = PaymentRecipientType.valueOf(request.paymentRecipient)
            
            // Process hero photo if provided
            request.heroPhoto?.let { base64Photo ->
                val (photoBytes, contentType) = com.club.triathlon.util.PhotoUtils.processPhoto(base64Photo)
                heroPhoto = photoBytes
                heroPhotoContentType = contentType
            }
        }
        val saved = courseRepository.save(course)
        val rule = RecurrenceRuleParser.parse(request.recurrenceRule)
        courseSchedulerService.regenerateOccurrences(saved, rule)
        return saved.toResponse()
    }

    @Transactional
    fun updateCourse(id: UUID, request: CourseRequest): CourseResponse {
        val course = fetchCourseForUpdate(id)
        val currentUser = currentUser()
        val coach = resolveCoach(request.coachId, currentUser)
        val location = fetchLocation(request.locationId)
        val sport = fetchSportByCode(request.sport)
        
        // Resolve club if provided
        val club = request.clubId?.let { clubId ->
            clubRepository.findById(clubId).orElseThrow {
                ResponseStatusException(HttpStatus.BAD_REQUEST, "Club not found")
            }
        }

        course.apply {
            name = request.name
            this.sport = sport
            level = request.level
            ageFrom = request.ageFrom
            ageTo = request.ageTo
            this.location = location
            capacity = request.capacity
            price = request.price
            pricePerSession = request.pricePerSession
            packageOptions = request.packageOptions
            recurrenceRule = request.recurrenceRule
            active = request.active
            description = request.description
            this.coach = coach
            
            // Club and payment settings
            this.club = club
            this.paymentRecipient = PaymentRecipientType.valueOf(request.paymentRecipient)
            
            // Process hero photo if provided
            request.heroPhoto?.let { base64Photo ->
                val (photoBytes, contentType) = com.club.triathlon.util.PhotoUtils.processPhoto(base64Photo)
                heroPhoto = photoBytes
                heroPhotoContentType = contentType
            }
        }
        val saved = courseRepository.save(course)
        val rule = RecurrenceRuleParser.parse(request.recurrenceRule)
        courseSchedulerService.regenerateOccurrences(saved, rule)
        return saved.toResponse()
    }

    @Transactional(readOnly = true)
    fun listCourses(): List<CourseResponse> {
        val currentUser = currentUser()
        val courses = if (currentUser.role == Role.ADMIN) {
            courseRepository.findAll()
        } else {
            courseRepository.findByCoach(currentUser)
        }
        return courses.map { it.toResponse() }
    }

    @Transactional(readOnly = true)
    fun getCourseForCoach(id: UUID): CourseResponse {
        val currentUser = currentUser()
        val course = courseRepository.findById(id).orElseThrow {
            ResponseStatusException(HttpStatus.NOT_FOUND, "Course not found")
        }
        if (currentUser.role != Role.ADMIN && course.coach.id != currentUser.id) {
            throw ResponseStatusException(HttpStatus.FORBIDDEN, "Cannot view this course")
        }
        return course.toResponse()
    }

    @Transactional(readOnly = true)
    fun getCourseForClub(id: UUID): CourseResponse {
        val currentUser = currentUser()
        if (currentUser.role != Role.CLUB) {
            throw ResponseStatusException(HttpStatus.FORBIDDEN, "Cannot view this course")
        }
        val club = clubRepository.findByOwnerId(currentUser.id!!)
            ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "Club not found for this user")

        val course = courseRepository.findById(id).orElseThrow {
            ResponseStatusException(HttpStatus.NOT_FOUND, "Course not found")
        }
        if (course.club?.id != club.id) {
            throw ResponseStatusException(HttpStatus.NOT_FOUND, "Course not found")
        }
        return course.toResponse()
    }

    private fun fetchCourseForUpdate(id: UUID): Course {
        val currentUser = currentUser()
        val course = courseRepository.findById(id).orElseThrow {
            ResponseStatusException(HttpStatus.NOT_FOUND, "Course not found")
        }
        if (currentUser.role == Role.ADMIN) {
            return course
        }
        if (currentUser.role == Role.COACH && course.coach.id == currentUser.id) {
            return course
        }
        if (currentUser.role == Role.CLUB) {
            val club = clubRepository.findByOwnerId(currentUser.id!!)
                ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "Club not found for this user")
            if (course.club?.id == club.id) {
                return course
            }
        }

        throw ResponseStatusException(HttpStatus.FORBIDDEN, "Cannot modify this course")
    }

    private fun fetchLocation(id: UUID): Location {
        return locationRepository.findById(id).orElseThrow {
            ResponseStatusException(HttpStatus.BAD_REQUEST, "Location not found")
        }
    }

    private fun fetchSportByCode(code: String): Sport {
        return sportRepository.findByCode(code).orElseThrow {
            ResponseStatusException(HttpStatus.BAD_REQUEST, "Sport with code '$code' not found")
        }
    }

    private fun resolveCoach(coachId: UUID?, currentUser: User): User {
        return if (currentUser.role == Role.COACH) {
            currentUser
        } else {
            if (coachId == null) throw ResponseStatusException(HttpStatus.BAD_REQUEST, "coachId is required for admin")
            userRepository.findById(coachId).orElseThrow {
                ResponseStatusException(HttpStatus.BAD_REQUEST, "Coach not found")
            }.takeIf { it.role == Role.COACH }
                ?: throw ResponseStatusException(HttpStatus.BAD_REQUEST, "User is not a coach")
        }
    }

    private fun currentUser(): User {
        val authentication = SecurityContextHolder.getContext().authentication
        val principal = authentication?.principal
        if (principal is com.club.triathlon.security.UserPrincipal) {
            return principal.user
        }
        throw ResponseStatusException(HttpStatus.UNAUTHORIZED, "Unauthenticated")
    }
}

data class CourseRequest(
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
    // Club association and payment settings
    val clubId: UUID? = null,
    val paymentRecipient: String = "COACH" // "COACH" or "CLUB"
)

data class CourseResponse(
    val id: UUID,
    val name: String,
    val sport: String,
    val level: String?,
    val ageFrom: Int?,
    val ageTo: Int?,
    val coachId: UUID,
    val locationId: UUID,
    val capacity: Int?,
    val price: Long,
    val pricePerSession: Long,
    val packageOptions: String? = null,
    val recurrenceRule: String?,
    val active: Boolean,
    val description: String?,
    val hasHeroPhoto: Boolean = false,
    val scheduleSlots: List<CourseScheduleSlot> = emptyList(),
    // Club association and payment settings
    val clubId: UUID? = null,
    val clubName: String? = null,
    val paymentRecipient: String = "COACH"
)

data class CourseScheduleSlot(
    val day: String,
    val dayLabel: String,
    val startTime: String,
    val endTime: String
)

private fun Course.toResponse(): CourseResponse {
    val scheduleSlots = buildScheduleSlots(this)
    return CourseResponse(
        id = this.id!!,
        name = this.name,
        sport = this.sport.code,
        level = this.level,
        ageFrom = this.ageFrom,
        ageTo = this.ageTo,
        coachId = this.coach.id!!,
        locationId = this.location.id!!,
        capacity = this.capacity,
        price = this.price,
        pricePerSession = this.pricePerSession,
        packageOptions = this.packageOptions,
        recurrenceRule = this.recurrenceRule,
        active = this.active,
        description = this.description,
        hasHeroPhoto = this.heroPhoto != null,
        scheduleSlots = scheduleSlots,
        clubId = this.club?.id,
        clubName = this.club?.name,
        paymentRecipient = this.paymentRecipient.name
    )
}

private fun buildScheduleSlots(course: Course): List<CourseScheduleSlot> {
    val ruleText = course.recurrenceRule ?: return emptyList()
    return try {
        val rule = RecurrenceRuleParser.parse(ruleText)
        val dayByNumber = mapOf(
            1 to ("MONDAY" to "Luni"),
            2 to ("TUESDAY" to "Marti"),
            3 to ("WEDNESDAY" to "Miercuri"),
            4 to ("THURSDAY" to "Joi"),
            5 to ("FRIDAY" to "Vineri"),
            6 to ("SATURDAY" to "Sambata"),
            7 to ("SUNDAY" to "Duminica")
        )
        rule.days.mapNotNull { number ->
            val definition = dayByNumber[number]
            val timeSlot = rule.getTimeSlot(number)
            if (definition != null && timeSlot != null) {
                CourseScheduleSlot(
                    day = definition.first,
                    dayLabel = definition.second,
                    startTime = timeSlot.start.toString(),
                    endTime = timeSlot.end.toString()
                )
            } else {
                null
            }
        }
    } catch (ex: Exception) {
        emptyList()
    }
}