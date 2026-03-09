package com.club.triathlon.web.public

import com.club.triathlon.service.camp.CampPublicDto
import com.club.triathlon.service.camp.CampPublicService
import org.slf4j.LoggerFactory
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/public/camps")
class PublicCampController(
    private val campPublicService: CampPublicService
) {
    
    private val logger = LoggerFactory.getLogger(PublicCampController::class.java)

    @GetMapping
    fun listCamps(): List<CampPublicDto> {
        logger.info("🏕️ [PUBLIC] Listing public camps")
        val camps = campPublicService.listPublicCamps()
        logger.info("✅ [PUBLIC] Retrieved ${camps.size} public camps")
        return camps
    }

    @GetMapping("/{slug}")
    fun getCamp(@PathVariable slug: String): CampPublicDto {
        logger.info("🏕️ [PUBLIC] Getting camp with slug: $slug")
        val camp = campPublicService.getCampBySlug(slug)
        logger.info("✅ [PUBLIC] Retrieved camp: ${camp.title}")
        return camp
    }
}