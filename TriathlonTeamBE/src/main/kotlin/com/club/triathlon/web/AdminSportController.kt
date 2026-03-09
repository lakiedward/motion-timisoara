package com.club.triathlon.web

import com.club.triathlon.service.AdminSportService
import com.club.triathlon.service.CreateSportRequest
import com.club.triathlon.service.SportDto
import com.club.triathlon.service.UpdateSportRequest
import jakarta.validation.Valid
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.security.access.prepost.PreAuthorize
import org.springframework.web.bind.annotation.*
import java.util.UUID

@RestController
@RequestMapping("/api/admin/sports")
@PreAuthorize("hasRole('ADMIN')")
class AdminSportController(
    private val adminSportService: AdminSportService
) {

    @GetMapping
    fun listSports(): ResponseEntity<List<SportDto>> {
        val sports = adminSportService.listSports()
        return ResponseEntity.ok(sports)
    }

    @PostMapping
    fun createSport(@Valid @RequestBody request: CreateSportRequest): ResponseEntity<SportDto> {
        val sport = adminSportService.createSport(request)
        return ResponseEntity.status(HttpStatus.CREATED).body(sport)
    }

    @PutMapping("/{id}")
    fun updateSport(
        @PathVariable id: UUID,
        @Valid @RequestBody request: UpdateSportRequest
    ): ResponseEntity<SportDto> {
        val sport = adminSportService.updateSport(id, request)
        return ResponseEntity.ok(sport)
    }

    @DeleteMapping("/{id}")
    fun deleteSport(@PathVariable id: UUID): ResponseEntity<Void> {
        adminSportService.deleteSport(id)
        return ResponseEntity.noContent().build()
    }
}



