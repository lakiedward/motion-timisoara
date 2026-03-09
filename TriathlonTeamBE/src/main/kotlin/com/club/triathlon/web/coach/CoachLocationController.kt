package com.club.triathlon.web.coach

import com.club.triathlon.repo.LocationRepository
import org.springframework.security.access.prepost.PreAuthorize
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController
import java.util.UUID

@RestController
@RequestMapping("/api/coach/locations")
@PreAuthorize("hasAnyRole('COACH','ADMIN')")
class CoachLocationController(
    private val locationRepository: LocationRepository
) {

    @GetMapping
    fun list(): List<LocationOption> = locationRepository
        .findAll()
        .sortedBy { it.name }
        .map { LocationOption(it.id!!, it.name, it.address) }
}

data class LocationOption(
    val id: UUID,
    val name: String,
    val address: String?
)

