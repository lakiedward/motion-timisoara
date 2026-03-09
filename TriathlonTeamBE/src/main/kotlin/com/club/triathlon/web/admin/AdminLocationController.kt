package com.club.triathlon.web.admin

import com.club.triathlon.domain.Location
import com.club.triathlon.enums.LocationType
import com.club.triathlon.repo.LocationRepository
import com.club.triathlon.security.UserPrincipal
import com.club.triathlon.service.DeleteLocationResult
import com.club.triathlon.service.LocationService
import jakarta.validation.Valid
import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.NotNull
import org.springframework.http.HttpStatus
import org.springframework.security.access.prepost.PreAuthorize
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.RestController
import org.springframework.web.server.ResponseStatusException
import java.util.UUID

@RestController
@RequestMapping("/api/admin/locations")
@PreAuthorize("hasRole('ADMIN')")
class AdminLocationController(
    private val locationRepository: LocationRepository,
    private val locationService: LocationService
) {

    @GetMapping
    fun list(): List<LocationResponse> =
        locationRepository.findAll().sortedBy { it.name }.map { it.toResponse() }

    @GetMapping("/{id}")
    fun getById(@PathVariable id: UUID): LocationResponse {
        val entity = locationRepository.findById(id).orElseThrow {
            ResponseStatusException(HttpStatus.NOT_FOUND, "Location not found")
        }
        return entity.toResponse()
    }

    @PostMapping
    fun create(
        @AuthenticationPrincipal principal: UserPrincipal,
        @Valid @RequestBody request: CreateOrUpdateLocationRequest
    ): LocationResponse {
        val entity = locationService.createLocation(
            name = request.name,
            city = null,
            address = request.address,
            type = request.type,
            lat = request.lat,
            lng = request.lng,
            createdBy = principal.user
        )
        return entity.toResponse()
    }

    @PutMapping("/{id}")
    fun update(
        @PathVariable id: UUID,
        @Valid @RequestBody request: CreateOrUpdateLocationRequest
    ): LocationResponse {
        val entity = locationRepository.findById(id).orElseThrow {
            ResponseStatusException(HttpStatus.NOT_FOUND, "Location not found")
        }
        entity.name = request.name
        entity.type = request.type
        entity.address = request.address
        entity.lat = request.lat
        entity.lng = request.lng
        return locationRepository.save(entity).toResponse()
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun delete(@PathVariable id: UUID) {
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

data class LocationResponse(
    val id: UUID,
    val name: String,
    val type: LocationType,
    val address: String?,
    val lat: Double?,
    val lng: Double?
)

data class CreateOrUpdateLocationRequest(
    @field:NotBlank
    val name: String,
    @field:NotNull
    val type: LocationType,
    val address: String? = null,
    val lat: Double? = null,
    val lng: Double? = null
)

private fun Location.toResponse() = LocationResponse(
    id = this.id!!,
    name = this.name,
    type = this.type,
    address = this.address,
    lat = this.lat,
    lng = this.lng
)

