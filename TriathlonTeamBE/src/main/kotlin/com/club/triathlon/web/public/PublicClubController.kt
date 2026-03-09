package com.club.triathlon.web.public

import com.club.triathlon.service.public.PublicClubService
import com.club.triathlon.service.public.PublicClubSummaryDto
import org.slf4j.LoggerFactory
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController
import java.util.UUID

@RestController
@RequestMapping("/api/public/clubs")
class PublicClubController(
    private val publicClubService: PublicClubService
) {

    private val logger = LoggerFactory.getLogger(PublicClubController::class.java)

    @GetMapping
    fun listClubs(): List<PublicClubSummaryDto> {
        logger.info("🏢 [PUBLIC] Listing public clubs")
        val clubs = publicClubService.listClubs()
        logger.info("✅ [PUBLIC] Retrieved ${clubs.size} public clubs")
        return clubs
    }

    @GetMapping("/{id}")
    fun getClub(@PathVariable id: UUID): com.club.triathlon.service.public.PublicClubDetailDto {
        logger.info("🏢 [PUBLIC] Getting public club with ID: $id")
        val club = publicClubService.getClubDetail(id)
        logger.info("✅ [PUBLIC] Retrieved public club: ${club.name}")
        return club
    }

    @GetMapping("/{id}/logo")
    fun getClubLogo(@PathVariable id: UUID): ResponseEntity<ByteArray> {
        logger.info("📸 [PUBLIC] Retrieving logo for club ID: $id")
        val result = publicClubService.getClubLogo(id)
        logger.info("✅ [PUBLIC] Logo retrieved successfully for club ID: $id")
        return result
    }

    @GetMapping("/{id}/hero-photo")
    fun getClubHeroPhoto(@PathVariable id: UUID): ResponseEntity<ByteArray> {
        logger.info("🖼️ [PUBLIC] Retrieving hero photo for club ID: $id")
        val result = publicClubService.getClubHeroPhoto(id)
        logger.info("✅ [PUBLIC] Hero photo retrieved successfully for club ID: $id")
        return result
    }
}
