package com.club.triathlon.service.public

import com.club.triathlon.domain.Club
import com.club.triathlon.repo.ClubRepository
import com.club.triathlon.service.storage.StorageService
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.http.HttpStatus
import org.springframework.http.MediaType
import org.springframework.http.ResponseEntity
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.server.ResponseStatusException
import java.net.URI
import java.util.Locale
import java.util.UUID

@Service
class PublicClubService(
    private val clubRepository: ClubRepository
) {

    @Autowired(required = false)
    private var storageService: StorageService? = null

    @Transactional(readOnly = true)
    fun listClubs(): List<PublicClubSummaryDto> {
        return clubRepository.findAll()
            .filter { it.owner.enabled }
            .sortedBy { it.name.lowercase(Locale.getDefault()) }
            .map { club ->
                PublicClubSummaryDto(
                    id = club.id!!,
                    name = club.name,
                    description = club.description?.trim(),
                    city = club.city?.trim(),
                    website = club.website?.trim(),
                    phone = club.phone?.trim(),
                    logoUrl = resolveLogoUrl(club),
                    heroPhotoUrl = resolveHeroPhotoUrl(club),
                    coachCount = club.coaches.size,
                    sports = club.sports
                        .map { sport ->
                            PublicSportDto(
                                id = sport.id!!,
                                code = sport.code,
                                name = sport.name
                            )
                        }
                        .sortedBy { it.name.lowercase(Locale.getDefault()) },
                    email = if (club.publicEmailConsent) club.email?.trim() else null
                )
            }
    }

    @Transactional(readOnly = true)
    fun getClubDetail(clubId: UUID): PublicClubDetailDto {
        val club = clubRepository.findById(clubId)
            .orElseThrow { ResponseStatusException(HttpStatus.NOT_FOUND, "Club not found") }

        if (!club.owner.enabled) {
            throw ResponseStatusException(HttpStatus.NOT_FOUND, "Club not found")
        }

        return PublicClubDetailDto(
            id = club.id!!,
            name = club.name,
            description = club.description?.trim(),
            city = club.city?.trim(),
            website = club.website?.trim(),
            phone = club.phone?.trim(),
            logoUrl = resolveLogoUrl(club),
            heroPhotoUrl = resolveHeroPhotoUrl(club),
            coachCount = club.coaches.size,
            sports = club.sports
                .map { sport ->
                    PublicSportDto(
                        id = sport.id!!,
                        code = sport.code,
                        name = sport.name
                    )
                }
                .sortedBy { it.name.lowercase(Locale.getDefault()) },
            email = if (club.publicEmailConsent) club.email?.trim() else null
        )
    }

    @Transactional(readOnly = true)
    fun getClubLogo(clubId: UUID): ResponseEntity<ByteArray> {
        val club = clubRepository.findById(clubId)
            .orElseThrow { ResponseStatusException(HttpStatus.NOT_FOUND, "Club not found") }

        if (!club.owner.enabled) {
            throw ResponseStatusException(HttpStatus.NOT_FOUND, "Club not found")
        }

        // If S3 key exists, redirect to presigned URL
        club.logoS3Key?.let { key ->
            storageService?.let { storage ->
                val presignedUrl = storage.generatePresignedUrl(key)
                return ResponseEntity.status(HttpStatus.FOUND)
                    .location(URI.create(presignedUrl))
                    .build()
            }
        }

        if (club.logo == null) {
            throw ResponseStatusException(HttpStatus.NOT_FOUND, "Club has no logo")
        }

        val contentType = club.logoContentType?.let { MediaType.parseMediaType(it) }
            ?: MediaType.IMAGE_JPEG

        return ResponseEntity.ok()
            .contentType(contentType)
            .body(club.logo)
    }

    @Transactional(readOnly = true)
    fun getClubHeroPhoto(clubId: UUID): ResponseEntity<ByteArray> {
        val club = clubRepository.findById(clubId)
            .orElseThrow { ResponseStatusException(HttpStatus.NOT_FOUND, "Club not found") }

        if (!club.owner.enabled) {
            throw ResponseStatusException(HttpStatus.NOT_FOUND, "Club not found")
        }

        // If S3 key exists, redirect to presigned URL
        club.heroPhotoS3Key?.let { key ->
            storageService?.let { storage ->
                val presignedUrl = storage.generatePresignedUrl(key)
                return ResponseEntity.status(HttpStatus.FOUND)
                    .location(URI.create(presignedUrl))
                    .build()
            }
        }

        if (club.heroPhoto == null) {
            throw ResponseStatusException(HttpStatus.NOT_FOUND, "Club has no hero photo")
        }

        val contentType = club.heroPhotoContentType?.let { MediaType.parseMediaType(it) }
            ?: MediaType.IMAGE_JPEG

        return ResponseEntity.ok()
            .contentType(contentType)
            .body(club.heroPhoto)
    }

    private fun resolveLogoUrl(club: Club): String? {
        club.logoUrl?.takeIf { it.isNotBlank() }?.let { return it }
        club.logoS3Key?.let { key ->
            storageService?.let { return it.generatePresignedUrl(key) }
        }
        if (club.logo != null) {
            return "/api/public/clubs/${club.id}/logo"
        }
        return null
    }

    private fun resolveHeroPhotoUrl(club: Club): String? {
        club.heroPhotoS3Key?.let { key ->
            storageService?.let { return it.generatePresignedUrl(key) }
        }
        if (club.heroPhoto != null) {
            return "/api/public/clubs/${club.id}/hero-photo"
        }
        return null
    }
}

data class PublicClubSummaryDto(
    val id: UUID,
    val name: String,
    val description: String?,
    val city: String?,
    val website: String?,
    val phone: String?,
    val logoUrl: String?,
    val heroPhotoUrl: String?,
    val coachCount: Int,
    val sports: List<PublicSportDto>,
    val email: String?
)

data class PublicClubDetailDto(
    val id: UUID,
    val name: String,
    val description: String?,
    val city: String?,
    val website: String?,
    val phone: String?,
    val logoUrl: String?,
    val heroPhotoUrl: String?,
    val coachCount: Int,
    val sports: List<PublicSportDto>,
    val email: String?
)
