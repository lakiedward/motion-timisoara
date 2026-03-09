package com.club.triathlon.service.camp

import com.club.triathlon.domain.Camp
import com.club.triathlon.enums.EnrollmentKind
import com.club.triathlon.enums.EnrollmentStatus
import com.club.triathlon.repo.CampRepository
import com.club.triathlon.repo.EnrollmentRepository
import com.fasterxml.jackson.core.type.TypeReference
import com.fasterxml.jackson.databind.ObjectMapper
import org.springframework.http.HttpStatus
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.server.ResponseStatusException
import java.time.LocalDate

@Service
class CampPublicService(
    private val campRepository: CampRepository,
    private val enrollmentRepository: EnrollmentRepository,
    private val objectMapper: ObjectMapper
) {

    @Transactional(readOnly = true)
    fun listPublicCamps(): List<CampPublicDto> {
        val camps = campRepository.findAllByOrderByPeriodStartAsc()
        if (camps.isEmpty()) {
            return emptyList()
        }

        val campIds = camps.mapNotNull { it.id }
        val enrollmentCounts = if (campIds.isEmpty()) {
            emptyMap()
        } else {
            enrollmentRepository
                .findByKindAndEntityIdInAndStatusIn(EnrollmentKind.CAMP, campIds, ACTIVE_ENROLLMENT_STATUSES)
                .groupingBy { it.entityId }
                .eachCount()
        }

        return camps.map { camp ->
            val count = camp.id?.let { enrollmentCounts[it] } ?: 0
            camp.toPublicDto(count)
        }
    }

    @Transactional(readOnly = true)
    fun getCampBySlug(slug: String): CampPublicDto {
        val camp = campRepository.findBySlug(slug).orElseThrow {
            ResponseStatusException(HttpStatus.NOT_FOUND, "Camp not found")
        }
        val enrollmentCount = camp.id?.let {
            enrollmentRepository.countByKindAndEntityIdAndStatusIn(
                EnrollmentKind.CAMP,
                it,
                ACTIVE_ENROLLMENT_STATUSES
            ).toInt()
        } ?: 0
        return camp.toPublicDto(enrollmentCount)
    }

    private fun Camp.toPublicDto(enrollmentCount: Int): CampPublicDto {
        val gallery = parseGallery(this.galleryJson)
        val capacityValue = this.capacity ?: 0
        val soldOut = capacityValue > 0 && enrollmentCount >= capacityValue

        return CampPublicDto(
            title = this.title,
            slug = this.slug,
            summary = buildSummary(this.description),
            description = this.description,
            periodStart = this.periodStart,
            periodEnd = this.periodEnd,
            locationText = this.locationText,
            capacity = capacityValue,
            price = this.price,
            soldOut = soldOut,
            allowCash = this.allowCash,
            heroImageUrl = gallery.firstOrNull(),
            gallery = gallery
        )
    }

    private fun parseGallery(galleryJson: String?): List<String> {
        if (galleryJson.isNullOrBlank()) {
            return emptyList()
        }
        return try {
            objectMapper.readValue(galleryJson, galleryTypeReference)
                .map { it.trim() }
                .filter { it.isNotEmpty() }
        } catch (_: Exception) {
            emptyList()
        }
    }

    private fun buildSummary(description: String?): String? {
        val trimmed = description?.trim() ?: return null
        if (trimmed.isEmpty()) {
            return null
        }
        return trimmed.replace(WHITESPACE_REGEX, " ")
            .take(MAX_SUMMARY_LENGTH)
    }

    companion object {
        private const val MAX_SUMMARY_LENGTH = 240
        private val WHITESPACE_REGEX = "\\s+".toRegex()
        private val ACTIVE_ENROLLMENT_STATUSES = listOf(EnrollmentStatus.ACTIVE, EnrollmentStatus.PENDING)
        private val galleryTypeReference = object : TypeReference<List<String>>() {}
    }
}

data class CampPublicDto(
    val title: String,
    val slug: String,
    val summary: String?,
    val description: String?,
    val periodStart: LocalDate,
    val periodEnd: LocalDate,
    val locationText: String?,
    val capacity: Int,
    val price: Long,
    val soldOut: Boolean,
    val allowCash: Boolean,
    val heroImageUrl: String?,
    val gallery: List<String>
)
