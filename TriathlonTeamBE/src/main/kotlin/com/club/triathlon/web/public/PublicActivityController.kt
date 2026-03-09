package com.club.triathlon.web.public

import com.club.triathlon.repo.ActivityRepository
import com.club.triathlon.service.public.PublicActivityDetailDto
import com.club.triathlon.service.public.PublicActivityService
import com.club.triathlon.service.public.PublicActivitySummaryDto
import org.slf4j.LoggerFactory
import org.springframework.http.HttpStatus
import org.springframework.http.MediaType
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController
import org.springframework.web.server.ResponseStatusException
import java.util.Base64
import java.util.UUID

@RestController
@RequestMapping("/api/public/activities")
class PublicActivityController(
    private val publicActivityService: PublicActivityService,
    private val activityRepository: ActivityRepository
) {
    private val logger = LoggerFactory.getLogger(PublicActivityController::class.java)

    /**
     * Get list of upcoming active activities
     */
    @GetMapping
    fun listActivities(@RequestParam(required = false, defaultValue = "false") includePast: Boolean): List<PublicActivitySummaryDto> {
        logger.info("📋 [ENDPOINT] GET /api/public/activities - Listing activities (includePast=$includePast)")
        return if (includePast) {
            publicActivityService.listAllActiveActivities()
        } else {
            publicActivityService.listUpcomingActivities()
        }
    }

    /**
     * Get detailed information about a specific activity
     */
    @GetMapping("/{activityId}")
    fun getActivityDetail(@PathVariable activityId: UUID): PublicActivityDetailDto {
        logger.info("🎯 [ENDPOINT] GET /api/public/activities/$activityId - Getting activity details")
        return publicActivityService.getActivityDetail(activityId)
    }

    /**
     * Get the hero photo for an activity
     */
    @GetMapping("/{activityId}/hero-photo")
    fun getActivityHeroPhoto(@PathVariable activityId: UUID): ResponseEntity<ByteArray> {
        val activity = activityRepository.findById(activityId).orElseThrow {
            ResponseStatusException(HttpStatus.NOT_FOUND, "Activity not found")
        }

        if (!activity.active) {
            throw ResponseStatusException(HttpStatus.NOT_FOUND, "Activity not found")
        }

        if (activity.heroPhoto.isNullOrBlank()) {
            throw ResponseStatusException(HttpStatus.NOT_FOUND, "Activity has no hero photo")
        }

        // heroPhoto is stored as base64 data URL (data:image/...;base64,...)
        val photoData = activity.heroPhoto!!
        
        // Parse the data URL
        val (contentType, imageBytes) = parseDataUrl(photoData)

        return ResponseEntity.ok()
            .contentType(MediaType.parseMediaType(contentType))
            .body(imageBytes)
    }

    /**
     * Parse a data URL and return content type and decoded bytes
     */
    private fun parseDataUrl(dataUrl: String): Pair<String, ByteArray> {
        // Format: data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAA...
        return try {
            if (dataUrl.startsWith("data:")) {
                val commaIndex = dataUrl.indexOf(',')
                if (commaIndex > 0) {
                    val metadata = dataUrl.substring(5, commaIndex)
                    val base64Data = dataUrl.substring(commaIndex + 1)
                    
                    val contentType = metadata.substringBefore(';')
                    val imageBytes = Base64.getDecoder().decode(base64Data)
                    
                    Pair(contentType, imageBytes)
                } else {
                    // Fallback: assume it's raw base64 JPEG
                    Pair("image/jpeg", Base64.getDecoder().decode(dataUrl))
                }
            } else {
                // Assume raw base64 JPEG
                Pair("image/jpeg", Base64.getDecoder().decode(dataUrl))
            }
        } catch (e: Exception) {
            logger.error("Failed to parse data URL: ${e.message}")
            throw ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to process image")
        }
    }
}
