package com.club.triathlon.config

import com.club.triathlon.domain.Camp
import com.club.triathlon.domain.Child
import com.club.triathlon.domain.CoachProfile
import com.club.triathlon.domain.Course
import com.club.triathlon.domain.Location
import com.club.triathlon.domain.Sport
import com.club.triathlon.domain.User
import com.club.triathlon.enums.EnrollmentStatus
import com.club.triathlon.enums.LocationType
import com.club.triathlon.enums.Role
import com.club.triathlon.repo.CampRepository
import com.club.triathlon.repo.ChildRepository
import com.club.triathlon.repo.CoachProfileRepository
import com.club.triathlon.repo.CourseRepository
import com.club.triathlon.repo.LocationRepository
import com.club.triathlon.repo.SportRepository
import com.club.triathlon.repo.UserRepository
import com.club.triathlon.service.course.CourseSchedulerService
import com.club.triathlon.service.course.RecurrenceRuleParser
import jakarta.annotation.PostConstruct
import org.slf4j.LoggerFactory
import org.springframework.boot.CommandLineRunner
import org.springframework.context.annotation.Profile
import org.springframework.security.crypto.password.PasswordEncoder
import org.springframework.stereotype.Component
import java.time.LocalDate
import java.time.OffsetDateTime

@Component
@Profile("dev")
class DevDataInitializer(
    private val userRepository: UserRepository,
    private val coachProfileRepository: CoachProfileRepository,
    private val childRepository: ChildRepository,
    private val locationRepository: LocationRepository,
    private val courseRepository: CourseRepository,
    private val campRepository: CampRepository,
    private val sportRepository: SportRepository,
    private val courseSchedulerService: CourseSchedulerService,
    private val passwordEncoder: PasswordEncoder
) : CommandLineRunner {

    private val logger = LoggerFactory.getLogger(DevDataInitializer::class.java)

    override fun run(vararg args: String?) {
        if (userRepository.existsByEmail("admin@club.ro")) {
            logger.info("Dev seed already applied")
            return
        }

        val now = OffsetDateTime.now()

        val admin = User().apply {
            email = "admin@club.ro"
            passwordHash = passwordEncoder.encode("Admin!234")
            name = "Admin"
            phone = "0700000000"
            role = Role.ADMIN
            createdAt = now
            enabled = true
        }
        userRepository.save(admin)

        val coach = User().apply {
            email = "coach@club.ro"
            passwordHash = passwordEncoder.encode("Coach!234")
            name = "Coach"
            phone = "0711111111"
            role = Role.COACH
            createdAt = now
            enabled = true
        }
        userRepository.save(coach)

        // Create or find Swimming sport
        val swimmingSport = sportRepository.findByCode("SWIM").orElseGet {
            val sport = Sport().apply {
                code = "SWIM"
                name = "Swimming"
            }
            sportRepository.save(sport)
        }

        val coachProfile = CoachProfile().apply {
            user = coach
            bio = "Coach biography"
            sports = mutableSetOf(swimmingSport)
            avatarUrl = null
        }
        coachProfileRepository.save(coachProfile)

        val parent = User().apply {
            email = "parinte@club.ro"
            passwordHash = passwordEncoder.encode("Parent!234")
            name = "Parinte"
            phone = "0722222222"
            role = Role.PARENT
            createdAt = now
            enabled = true
        }
        userRepository.save(parent)

        val child = Child().apply {
            this.parent = parent
            name = "Copil"
            birthDate = LocalDate.of(2014, 5, 20)
        }
        childRepository.save(child)

        val location = Location().apply {
            name = "Bazin Central"
            type = LocationType.POOL
            address = "Strada Sportului 1"
            lat = 44.4268
            lng = 26.1025
        }
        locationRepository.save(location)

        val recurrenceRule = """{""days"": [2,4], ""start"": ""18:00"", ""end"": ""19:00""}"""
        val course = Course().apply {
            name = "Curs inot copii"
            sport = swimmingSport
            level = "Beginner"
            ageFrom = 8
            ageTo = 12
            this.coach = coach
            this.location = location
            capacity = 12
            price = 250000       // 2500 RON in bani (monthly package ~10 sessions)
            pricePerSession = 25000  // 250 RON per session in bani
            this.recurrenceRule = recurrenceRule
            active = true
        }
        val savedCourse = courseRepository.save(course)
        val rule = RecurrenceRuleParser.parse(recurrenceRule)
        courseSchedulerService.regenerateOccurrences(savedCourse, rule)

        val camp = Camp().apply {
            title = "Tabara de vara"
            slug = "tabara-vara"
            description = "Program intensiv pentru copii"
            periodStart = LocalDate.now().plusWeeks(2)
            periodEnd = periodStart.plusDays(5)
            locationText = "Poiana Brasov"
            capacity = 20
            price = 1500000  // 15000 RON in bani
            galleryJson = "[]"
            allowCash = true
        }
        val savedCamp = campRepository.save(camp)

        logger.info("Seeded admin id=${admin.id}")
        logger.info("Seeded coach id=${coach.id}")
        logger.info("Seeded parent id=${parent.id}, child id=${child.id}")
        logger.info("Seeded location id=${location.id}")
        logger.info("Seeded course id=${savedCourse.id}")
        logger.info("Seeded camp id=${savedCamp.id}")
    }
}
