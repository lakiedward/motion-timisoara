package com.club.triathlon.web

import com.club.triathlon.domain.Location
import com.club.triathlon.enums.Role
import com.club.triathlon.enums.LocationType
import com.club.triathlon.security.UserPrincipal
import com.club.triathlon.service.DeleteLocationResult
import com.club.triathlon.service.LocationService
import jakarta.validation.Valid
import jakarta.validation.constraints.NotBlank
import org.slf4j.LoggerFactory
import org.springframework.http.HttpStatus
import org.springframework.security.access.prepost.PreAuthorize
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.*
import org.springframework.web.server.ResponseStatusException
import java.util.UUID

/**
 * Unified Location Controller
 * All locations are shared/global - anyone can search and use them
 * Authenticated users can create new locations
 */
@RestController
@RequestMapping("/api/locations")
class LocationController(
    private val locationService: LocationService
) {
    private val logger = LoggerFactory.getLogger(LocationController::class.java)

    // ============================================
    // Public Endpoints (no auth required)
    // ============================================

    /**
     * Get all available cities with locations
     */
    @GetMapping("/cities")
    fun getCities(): List<String> {
        return locationService.getAllCities()
    }

    /**
     * Search locations with optional filters
     * - city: filter by city
     * - query: search by name or address
     */
    @GetMapping("/search")
    fun searchLocations(
        @RequestParam(required = false) city: String?,
        @RequestParam(required = false) query: String?
    ): List<LocationDto> {
        val locations = locationService.searchLocations(city, query)
        return locations.map { it.toDto() }
    }

    /**
     * Get locations by city
     */
    @GetMapping("/by-city/{city}")
    fun getByCity(@PathVariable city: String): List<LocationDto> {
        return locationService.getLocationsByCity(city).map { it.toDto() }
    }

    /**
     * Get a specific location by ID
     */
    @GetMapping("/{id}")
    fun getById(@PathVariable id: UUID): LocationDto {
        val location = locationService.getById(id)
            ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "Location not found")
        return location.toDto()
    }

    /**
     * Check for similar locations (deduplication helper)
     */
    @GetMapping("/similar")
    fun findSimilar(
        @RequestParam city: String,
        @RequestParam name: String
    ): List<LocationDto> {
        return locationService.findSimilarLocations(city, name).map { it.toDto() }
    }

    // ============================================
    // Authenticated Endpoints
    // ============================================

    /**
     * Get user's recent locations
     */
    @GetMapping("/recent")
    @PreAuthorize("isAuthenticated()")
    fun getRecentLocations(
        @AuthenticationPrincipal principal: UserPrincipal,
        @RequestParam(required = false) city: String?,
        @RequestParam(defaultValue = "10") limit: Int
    ): List<LocationDto> {
        val locations = locationService.getRecentLocations(principal.user.id!!, city, limit)
        return locations.map { it.toDto() }
    }

    /**
     * Create a new location (any authenticated user can create)
     */
    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN','COACH','CLUB')")
    fun createLocation(
        @AuthenticationPrincipal principal: UserPrincipal,
        @Valid @RequestBody request: CreateLocationRequest
    ): LocationDto {
        val type = request.type?.let { 
            try { LocationType.valueOf(it) } catch (e: Exception) { LocationType.OTHER }
        } ?: LocationType.OTHER

        val location = locationService.createLocation(
            name = request.name,
            city = request.city,
            address = request.address,
            type = type,
            lat = request.lat,
            lng = request.lng,
            description = request.description,
            capacity = request.capacity,
            createdBy = principal.user
        )
        
        logger.info("📍 User ${principal.user.email} created location: ${location.name} in ${location.city}")
        return location.toDto()
    }

    /**
     * Track that user used a location (for recent locations feature)
     */
    @PostMapping("/{id}/track-usage")
    @PreAuthorize("isAuthenticated()")
    fun trackUsage(
        @AuthenticationPrincipal principal: UserPrincipal,
        @PathVariable id: UUID
    ) {
        locationService.trackLocationUsage(principal.user, id)
    }

    // ============================================
    // Admin-only Endpoints
    // ============================================

    /**
     * Update a location (admin only for now)
     */
    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','COACH')")
    fun updateLocation(
        @AuthenticationPrincipal principal: UserPrincipal,
        @PathVariable id: UUID,
        @Valid @RequestBody request: UpdateLocationRequest
    ): LocationDto {
        val existing = locationService.getById(id)
            ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "Location not found")

        val user = principal.user
        if (user.role == Role.COACH) {
            if (existing.club != null) {
                throw ResponseStatusException(HttpStatus.FORBIDDEN, "Nu puteți modifica o locație asociată unui club")
            }
            if (existing.createdByUser?.id != user.id) {
                throw ResponseStatusException(HttpStatus.FORBIDDEN, "Nu puteți modifica această locație")
            }
        }

        val type = request.type?.let { 
            try { LocationType.valueOf(it) } catch (e: Exception) { null }
        }

        val location = locationService.updateLocation(
            id = id,
            name = request.name,
            city = request.city,
            address = request.address,
            type = type,
            lat = request.lat,
            lng = request.lng,
            description = request.description,
            capacity = request.capacity,
            isActive = request.isActive
        ) ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "Location not found")
        
        return location.toDto()
    }

    /**
     * Delete a location (admin only)
     */
    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','COACH')")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun deleteLocation(
        @AuthenticationPrincipal principal: UserPrincipal,
        @PathVariable id: UUID
    ) {
        val existing = locationService.getById(id)
            ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "Locația nu a fost găsită")

        val user = principal.user
        if (user.role == Role.COACH) {
            if (existing.club != null) {
                throw ResponseStatusException(HttpStatus.FORBIDDEN, "Nu puteți șterge o locație asociată unui club")
            }
            if (existing.createdByUser?.id != user.id) {
                throw ResponseStatusException(HttpStatus.FORBIDDEN, "Nu puteți șterge această locație")
            }
        }

        when (val result = locationService.deleteLocation(id)) {
            is DeleteLocationResult.Success -> { /* OK */ }
            is DeleteLocationResult.NotFound -> 
                throw ResponseStatusException(HttpStatus.NOT_FOUND, "Locația nu a fost găsită")
            is DeleteLocationResult.HasCourses -> 
                throw ResponseStatusException(
                    HttpStatus.CONFLICT, 
                    "Nu se poate șterge locația. Există ${result.count} curs(uri) asociat(e). Ștergeți sau mutați cursurile mai întâi."
                )
            is DeleteLocationResult.HasActivities -> 
                throw ResponseStatusException(
                    HttpStatus.CONFLICT, 
                    "Nu se poate șterge locația. Există activități asociate. Ștergeți sau mutați activitățile mai întâi."
                )
        }
    }
}

// ============================================
// DTOs
// ============================================

data class LocationDto(
    val id: UUID,
    val name: String,
    val city: String?,
    val address: String?,
    val type: String,
    val lat: Double?,
    val lng: Double?,
    val description: String?,
    val capacity: Int?,
    val createdByUserId: UUID?,
    val clubId: UUID?,
    @get:com.fasterxml.jackson.annotation.JsonProperty("isActive")
    val isActive: Boolean
)

data class CreateLocationRequest(
    @field:NotBlank(message = "Numele locației este obligatoriu")
    val name: String,
    val city: String? = null,
    val address: String? = null,
    val type: String? = null,
    val lat: Double? = null,
    val lng: Double? = null,
    val description: String? = null,
    val capacity: Int? = null
)

data class UpdateLocationRequest(
    val name: String? = null,
    val city: String? = null,
    val address: String? = null,
    val type: String? = null,
    val lat: Double? = null,
    val lng: Double? = null,
    val description: String? = null,
    val capacity: Int? = null,
    val isActive: Boolean? = null
)

// Extension function for mapping
private fun Location.toDto() = LocationDto(
    id = this.id!!,
    name = this.name,
    city = this.city,
    address = this.address,
    type = this.type.name,
    lat = this.lat,
    lng = this.lng,
    description = this.description,
    capacity = this.capacity,
    createdByUserId = this.createdByUser?.id,
    clubId = this.club?.id,
    isActive = this.isActive
)
