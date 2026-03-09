package com.club.triathlon.web.public

import com.club.triathlon.repo.LocationRepository
import org.slf4j.LoggerFactory
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController
import java.util.UUID

@RestController
@RequestMapping("/api/public/locations")
class PublicLocationController(
    private val locationRepository: LocationRepository
) {

    private val logger = LoggerFactory.getLogger(PublicLocationController::class.java)

    @GetMapping
    fun listLocations(): List<PublicLocationDto> {
        logger.info("📍 [PUBLIC] Listing locations")
        val locations = locationRepository.findAll()
            .filter { it.isActive }  // Only show active locations on public map
            .sortedBy { it.name }
            .map { PublicLocationDto(
                id = it.id!!, 
                name = it.name, 
                address = it.address, 
                city = it.city,
                lat = it.lat, 
                lng = it.lng,
                type = it.type.name
            ) }
        logger.info("✅ [PUBLIC] Found ${locations.size} active locations")
        return locations
    }
}

data class PublicLocationDto(
    val id: UUID,
    val name: String,
    val address: String?,
    val city: String?,
    val lat: Double?,
    val lng: Double?,
    val type: String
)


