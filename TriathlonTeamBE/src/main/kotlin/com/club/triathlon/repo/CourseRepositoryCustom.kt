package com.club.triathlon.repo

import com.club.triathlon.domain.Course
import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable
import java.util.UUID

interface CourseRepositoryCustom {
    fun findSchedule(filter: ScheduleFilter, pageable: Pageable): Page<Course>
}

data class ScheduleFilter(
    val sport: String? = null,
    val dayOfWeek: Int? = null,
    val level: String? = null,
    val ageFrom: Int? = null,
    val ageTo: Int? = null,
    val locationId: UUID? = null,
    val coachId: UUID? = null,
    val clubId: UUID? = null,
    val onlyActive: Boolean = true
)
