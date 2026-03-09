package com.club.triathlon.web.public

import com.club.triathlon.service.AdminSportService
import com.club.triathlon.service.SportDto
import org.slf4j.LoggerFactory
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/public/sports")
class PublicSportController(
    private val adminSportService: AdminSportService
) {
    
    private val logger = LoggerFactory.getLogger(PublicSportController::class.java)

    @GetMapping
    fun listSports(): List<SportDto> {
        logger.info("🏃 [PUBLIC] Listing public sports")
        val sports = adminSportService.listSports()
        logger.info("✅ [PUBLIC] Found ${sports.size} sports")
        return sports
    }
}
