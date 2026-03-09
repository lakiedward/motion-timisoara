package com.club.triathlon.service.camp

import com.club.triathlon.domain.Camp
import com.club.triathlon.repo.CampRepository
import org.springframework.http.HttpStatus
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.server.ResponseStatusException
import java.time.LocalDate
import java.util.UUID

@Service
class CampAdminService(
    private val campRepository: CampRepository
) {

    @Transactional
    fun createCamp(request: CampRequest): CampDto {
        validateRequest(request)
        if (campRepository.existsBySlug(request.slug)) {
            throw ResponseStatusException(HttpStatus.CONFLICT, "Slug already in use")
        }
        val camp = Camp().apply { updateFromRequest(request) }
        val saved = campRepository.save(camp)
        return saved.toDto()
    }

    @Transactional
    fun updateCamp(id: UUID, request: CampRequest): CampDto {
        validateRequest(request)
        val camp = campRepository.findById(id).orElseThrow {
            ResponseStatusException(HttpStatus.NOT_FOUND, "Camp not found")
        }
        if (camp.slug != request.slug && campRepository.existsBySlug(request.slug)) {
            throw ResponseStatusException(HttpStatus.CONFLICT, "Slug already in use")
        }
        camp.updateFromRequest(request)
        return campRepository.save(camp).toDto()
    }

    @Transactional(readOnly = true)
    fun listCamps(): List<CampDto> = campRepository.findAllByOrderByPeriodStartAsc().map { it.toDto() }

    private fun validateRequest(request: CampRequest) {
        if (!request.periodStart.isBefore(request.periodEnd)) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "periodStart must be before periodEnd")
        }
        if (request.capacity <= 0) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "capacity must be greater than 0")
        }
        if (request.price <= 0) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "price must be greater than 0")
        }
    }

    private fun Camp.updateFromRequest(request: CampRequest) {
        title = request.title
        slug = request.slug
        description = request.description
        periodStart = request.periodStart
        periodEnd = request.periodEnd
        locationText = request.locationText
        capacity = request.capacity
        price = request.price
        galleryJson = request.galleryJson
        allowCash = request.allowCash
    }
}

data class CampRequest(
    val title: String,
    val slug: String,
    val description: String?,
    val periodStart: LocalDate,
    val periodEnd: LocalDate,
    val locationText: String?,
    val capacity: Int,
    val price: Long,
    val galleryJson: String?,
    val allowCash: Boolean
)

data class CampDto(
    val id: UUID,
    val title: String,
    val slug: String,
    val description: String?,
    val periodStart: LocalDate,
    val periodEnd: LocalDate,
    val locationText: String?,
    val capacity: Int,
    val price: Long,
    val galleryJson: String?,
    val allowCash: Boolean
)

fun Camp.toDto() = CampDto(
    id = this.id!!,
    title = this.title,
    slug = this.slug,
    description = this.description,
    periodStart = this.periodStart,
    periodEnd = this.periodEnd,
    locationText = this.locationText,
    capacity = this.capacity ?: 0,
    price = this.price,
    galleryJson = this.galleryJson,
    allowCash = this.allowCash
)