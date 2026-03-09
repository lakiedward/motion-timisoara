package com.club.triathlon.service

import com.club.triathlon.domain.Sport
import com.club.triathlon.repo.CoachProfileRepository
import com.club.triathlon.repo.SportRepository
import jakarta.validation.constraints.NotBlank
import org.springframework.http.HttpStatus
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.server.ResponseStatusException
import java.util.UUID

@Service
class AdminSportService(
    private val sportRepository: SportRepository,
    private val coachProfileRepository: CoachProfileRepository
) {

    @Transactional(readOnly = true)
    fun listSports(): List<SportDto> {
        return sportRepository.findAllByOrderByNameAsc()
            .map { it.toDto() }
    }

    @Transactional
    fun createSport(request: CreateSportRequest): SportDto {
        if (sportRepository.existsByCode(request.code)) {
            throw ResponseStatusException(HttpStatus.CONFLICT, "Sport with code '${request.code}' already exists")
        }

        val sport = Sport().apply {
            code = request.code
            name = request.name
        }
        val saved = sportRepository.save(sport)
        return saved.toDto()
    }

    @Transactional
    fun updateSport(id: UUID, request: UpdateSportRequest): SportDto {
        val sport = sportRepository.findById(id).orElseThrow {
            ResponseStatusException(HttpStatus.NOT_FOUND, "Sport not found")
        }

        // Check if code is being changed and if it already exists
        if (request.code != sport.code && sportRepository.existsByCode(request.code)) {
            throw ResponseStatusException(HttpStatus.CONFLICT, "Sport with code '${request.code}' already exists")
        }

        sport.code = request.code
        sport.name = request.name
        val updated = sportRepository.save(sport)
        return updated.toDto()
    }

    @Transactional
    fun deleteSport(id: UUID) {
        val sport = sportRepository.findById(id).orElseThrow {
            ResponseStatusException(HttpStatus.NOT_FOUND, "Sport not found")
        }

        // Check if any coach profile is using this sport
        val coachProfiles = coachProfileRepository.findAll()
        val isUsed = coachProfiles.any { profile -> profile.sports.any { it.id == id } }
        
        if (isUsed) {
            throw ResponseStatusException(
                HttpStatus.CONFLICT,
                "Cannot delete sport that is associated with coaches"
            )
        }

        sportRepository.delete(sport)
    }
}

data class SportDto(
    val id: UUID,
    val code: String,
    val name: String
)

data class CreateSportRequest(
    @field:NotBlank
    val code: String,
    @field:NotBlank
    val name: String
)

data class UpdateSportRequest(
    @field:NotBlank
    val code: String,
    @field:NotBlank
    val name: String
)

private fun Sport.toDto() = SportDto(
    id = this.id!!,
    code = this.code,
    name = this.name
)



