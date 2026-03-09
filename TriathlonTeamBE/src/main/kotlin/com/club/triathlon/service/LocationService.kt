package com.club.triathlon.service

import com.club.triathlon.domain.Location
import com.club.triathlon.domain.Club
import com.club.triathlon.domain.User
import com.club.triathlon.domain.UserRecentLocation
import com.club.triathlon.enums.LocationType
import com.club.triathlon.repo.ActivityRepository
import com.club.triathlon.repo.CourseRepository
import com.club.triathlon.repo.LocationRepository
import com.club.triathlon.repo.UserRecentLocationRepository
import org.slf4j.LoggerFactory
import org.springframework.dao.DataIntegrityViolationException
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.OffsetDateTime
import java.util.UUID

@Service
class LocationService(
    private val locationRepository: LocationRepository,
    private val userRecentLocationRepository: UserRecentLocationRepository,
    private val courseRepository: CourseRepository,
    private val activityRepository: ActivityRepository
) {
    private val logger = LoggerFactory.getLogger(LocationService::class.java)

    // ============================================
    // Search & Filter
    // ============================================

    fun getAllCities(): List<String> {
        return locationRepository.findDistinctCities()
    }

    fun searchLocations(city: String?, query: String?): List<Location> {
        return when {
            !city.isNullOrBlank() && !query.isNullOrBlank() -> 
                locationRepository.searchByCityAndQuery(city, query)
            !city.isNullOrBlank() -> 
                locationRepository.findActiveByCityIgnoreCase(city)
            !query.isNullOrBlank() -> 
                locationRepository.searchByNameOrAddress(query)
            else -> 
                locationRepository.findAllActive()
        }
    }

    fun getLocationsByCity(city: String): List<Location> {
        return locationRepository.findActiveByCityIgnoreCase(city)
    }

    fun findSimilarLocations(city: String, name: String): List<Location> {
        return locationRepository.findSimilarLocations(city, name)
    }

    // ============================================
    // Recent Locations
    // ============================================

    fun getRecentLocations(userId: UUID, city: String? = null, limit: Int = 10): List<Location> {
        val recentRecords = if (!city.isNullOrBlank()) {
            userRecentLocationRepository.findByUserIdAndCityOrderByLastUsedDesc(userId, city)
        } else {
            userRecentLocationRepository.findByUserIdOrderByLastUsedDesc(userId)
        }
        return recentRecords.take(limit).map { it.location }
    }

    @Transactional
    fun trackLocationUsage(user: User, locationId: UUID) {
        val location = locationRepository.findById(locationId).orElse(null) ?: return
        
        val existing = userRecentLocationRepository.findByUserIdAndLocationId(user.id!!, locationId)
        
        if (existing != null) {
            existing.lastUsedAt = OffsetDateTime.now()
            existing.useCount += 1
            userRecentLocationRepository.save(existing)
        } else {
            val record = UserRecentLocation().apply {
                this.user = user
                this.location = location
                this.lastUsedAt = OffsetDateTime.now()
                this.useCount = 1
            }
            userRecentLocationRepository.save(record)
        }
        
        logger.debug("📍 Tracked location usage: ${location.name} for user ${user.email}")
    }

    // ============================================
    // CRUD Operations
    // ============================================

    fun getById(id: UUID): Location? {
        return locationRepository.findById(id).orElse(null)
    }

    @Transactional
    fun createLocation(
        name: String,
        city: String?,
        address: String?,
        type: LocationType = LocationType.OTHER,
        lat: Double? = null,
        lng: Double? = null,
        description: String? = null,
        capacity: Int? = null,
        createdBy: User? = null,
        club: Club? = null
    ): Location {
        val cityNorm = normalizeLocationKeyPart(city)
        val nameNorm = normalizeLocationKeyPart(name)
        val addressNorm = normalizeLocationKeyPart(address)

        val existing = locationRepository.findFirstByNormalizedCityNameAddress(
            cityNorm = cityNorm,
            nameNorm = nameNorm,
            addressNorm = addressNorm
        )
        if (existing != null) {
            val updated = enrichExistingLocation(existing, type, lat, lng, description, capacity)
            if (createdBy != null) {
                trackLocationUsage(createdBy, updated.id!!)
            }
            return updated
        }

        // Check for similar locations to avoid duplicates
        if (!city.isNullOrBlank()) {
            val similar = findSimilarLocations(city, name)
            if (similar.isNotEmpty()) {
                logger.warn("⚠️ Creating location '$name' in '$city' but similar locations exist: ${similar.map { it.name }}")
            }
        }

        val location = Location().apply {
            this.name = name
            this.city = city
            this.address = address
            this.type = type
            this.lat = lat
            this.lng = lng
            this.description = description
            this.capacity = capacity
            this.isActive = true
            this.createdByUser = createdBy
            this.club = club
        }

        val saved = try {
            locationRepository.save(location)
        } catch (ex: DataIntegrityViolationException) {
            val existingAfterConflict = locationRepository.findFirstByNormalizedCityNameAddress(
                cityNorm = cityNorm,
                nameNorm = nameNorm,
                addressNorm = addressNorm
            )
            if (existingAfterConflict != null) {
                val updated = enrichExistingLocation(existingAfterConflict, type, lat, lng, description, capacity)
                if (createdBy != null) {
                    trackLocationUsage(createdBy, updated.id!!)
                }
                return updated
            }
            throw ex
        }
        logger.info("✅ Location created: ${saved.name} in ${saved.city} by ${createdBy?.email ?: "system"}")
        
        // Auto-track for the creator
        if (createdBy != null) {
            trackLocationUsage(createdBy, saved.id!!)
        }
        
        return saved
    }

    private fun normalizeLocationKeyPart(value: String?): String {
        return (value ?: "")
            .replace(Regex("\\s+"), " ")
            .trim()
            .lowercase()
    }

    private fun enrichExistingLocation(
        existing: Location,
        type: LocationType,
        lat: Double?,
        lng: Double?,
        description: String?,
        capacity: Int?
    ): Location {
        var changed = false

        if (!existing.isActive) {
            existing.isActive = true
            changed = true
        }

        if (existing.type == LocationType.OTHER && type != LocationType.OTHER) {
            existing.type = type
            changed = true
        }

        if (existing.lat == null && lat != null) {
            existing.lat = lat
            changed = true
        }

        if (existing.lng == null && lng != null) {
            existing.lng = lng
            changed = true
        }

        if (existing.description.isNullOrBlank() && !description.isNullOrBlank()) {
            existing.description = description
            changed = true
        }

        if (existing.capacity == null && capacity != null) {
            existing.capacity = capacity
            changed = true
        }

        return if (changed) {
            locationRepository.save(existing)
        } else {
            existing
        }
    }

    @Transactional
    fun updateLocation(
        id: UUID,
        name: String? = null,
        city: String? = null,
        address: String? = null,
        type: LocationType? = null,
        lat: Double? = null,
        lng: Double? = null,
        description: String? = null,
        capacity: Int? = null,
        isActive: Boolean? = null
    ): Location? {
        val location = locationRepository.findById(id).orElse(null) ?: return null
        
        name?.let { location.name = it }
        city?.let { location.city = it }
        address?.let { location.address = it }
        type?.let { location.type = it }
        lat?.let { location.lat = it }
        lng?.let { location.lng = it }
        description?.let { location.description = it }
        capacity?.let { location.capacity = it }
        isActive?.let { location.isActive = it }
        
        return locationRepository.save(location)
    }

    @Transactional
    fun deleteLocation(id: UUID): DeleteLocationResult {
        if (!locationRepository.existsById(id)) {
            return DeleteLocationResult.NotFound
        }
        
        // Check for associated courses
        val courseCount = courseRepository.countByLocationId(id)
        if (courseCount > 0) {
            return DeleteLocationResult.HasCourses(courseCount.toInt())
        }
        
        // Check for associated activities
        if (activityRepository.existsByLocationId(id)) {
            return DeleteLocationResult.HasActivities
        }
        
        // Delete recent location records first
        userRecentLocationRepository.deleteByLocationId(id)
        
        // Now safe to delete
        locationRepository.deleteById(id)
        return DeleteLocationResult.Success
    }
}

sealed class DeleteLocationResult {
    object Success : DeleteLocationResult()
    object NotFound : DeleteLocationResult()
    data class HasCourses(val count: Int) : DeleteLocationResult()
    object HasActivities : DeleteLocationResult()
}
