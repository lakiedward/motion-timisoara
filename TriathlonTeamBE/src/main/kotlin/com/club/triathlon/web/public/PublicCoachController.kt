package com.club.triathlon.web.public

import com.club.triathlon.service.public.CoachDetailDto
import com.club.triathlon.service.public.CoachSummaryDto
import com.club.triathlon.service.public.PublicCoachService
import org.slf4j.LoggerFactory
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController
import java.util.UUID

@RestController
@RequestMapping("/api/public/coaches")
class PublicCoachController(
    private val publicCoachService: PublicCoachService
) {
    
    private val logger = LoggerFactory.getLogger(PublicCoachController::class.java)

    @GetMapping
    fun listCoaches(
        @RequestParam(required = false) sportId: UUID?,
        @RequestParam(required = false) locationId: UUID?,
        @RequestParam(required = false) clubId: UUID?
    ): List<CoachSummaryDto> {
        logger.info("🌐 [PUBLIC] Listing public coaches (sportId: $sportId, locationId: $locationId, clubId: $clubId)")
        val coaches = publicCoachService.listCoaches(sportId, locationId, clubId)
        logger.info("✅ [PUBLIC] Retrieved ${coaches.size} public coaches")
        return coaches
    }

    @GetMapping("/{id}")
    fun getCoach(@PathVariable id: UUID): CoachDetailDto {
        logger.info("🌐 [PUBLIC] Getting public coach with ID: $id")
        val coach = publicCoachService.getCoachDetail(id)
        logger.info("✅ [PUBLIC] Retrieved public coach: ${coach.name}")
        return coach
    }

    @GetMapping("/{id}/photo")
    fun getCoachPhoto(@PathVariable id: UUID): ResponseEntity<ByteArray> {
        logger.info("📸 [PUBLIC] Retrieving photo for coach ID: $id")
        val result = publicCoachService.getCoachPhoto(id)
        logger.info("✅ [PUBLIC] Photo retrieved successfully for coach ID: $id")
        return result
    }
}