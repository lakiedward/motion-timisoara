package com.club.triathlon.web.public

import com.club.triathlon.repo.ScheduleFilter
import com.club.triathlon.service.public.PublicScheduleService
import com.club.triathlon.service.public.ScheduleItem
import org.springframework.data.domain.PageRequest
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController
import java.util.UUID

@RestController
@RequestMapping("/api/public/schedule")
class PublicScheduleController(
    private val publicScheduleService: PublicScheduleService
) {

    @GetMapping
    fun getSchedule(
        @RequestParam(required = false) sport: String?,
        @RequestParam(required = false) dayOfWeek: Int?,
        @RequestParam(required = false) level: String?,
        @RequestParam(required = false) ageFrom: Int?,
        @RequestParam(required = false) ageTo: Int?,
        @RequestParam(required = false) locationId: String?,
        @RequestParam(required = false) coachId: String?,
        @RequestParam(required = false) clubId: String?,
        @RequestParam(defaultValue = "0") page: Int,
        @RequestParam(defaultValue = "20") size: Int
    ): ResponseEntity<PublicScheduleResponse> {
        val sanitizedPage = page.coerceAtLeast(0)
        val sanitizedSize = size.coerceIn(1, 100)
        val pageable = PageRequest.of(sanitizedPage, sanitizedSize)
        
        // Convert string IDs to UUID safely
        val locationUuid = locationId?.takeIf { it.isNotBlank() }?.let { 
            try { UUID.fromString(it) } catch (e: IllegalArgumentException) { null }
        }
        val coachUuid = coachId?.takeIf { it.isNotBlank() }?.let { 
            try { UUID.fromString(it) } catch (e: IllegalArgumentException) { null }
        }
        val clubUuid = clubId?.takeIf { it.isNotBlank() }?.let {
            try { UUID.fromString(it) } catch (e: IllegalArgumentException) { null }
        }
        
        val filter = ScheduleFilter(
            sport = sport?.takeIf { it.isNotBlank() },
            dayOfWeek = dayOfWeek,
            level = level?.takeIf { it.isNotBlank() },
            ageFrom = ageFrom,
            ageTo = ageTo,
            locationId = locationUuid,
            coachId = coachUuid,
            clubId = clubUuid,
            onlyActive = true
        )
        val pageResult = publicScheduleService.getSchedule(filter, pageable)
        val response = PublicScheduleResponse(
            content = pageResult.content,
            totalElements = pageResult.totalElements,
            totalPages = pageResult.totalPages,
            page = pageResult.number,
            size = pageResult.size
        )
        return ResponseEntity.ok(response)
    }
}

data class PublicScheduleResponse(
    val content: List<ScheduleItem>,
    val totalElements: Long,
    val totalPages: Int,
    val page: Int,
    val size: Int
)