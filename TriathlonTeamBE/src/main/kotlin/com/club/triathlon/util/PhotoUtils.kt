package com.club.triathlon.util

import org.springframework.http.HttpStatus
import org.springframework.web.server.ResponseStatusException
import java.util.Base64

object PhotoUtils {

    private const val MAX_PHOTO_SIZE = 10 * 1024 * 1024 // 10MB

    private val ALLOWED_CONTENT_TYPES = listOf(
        "image/jpeg",
        "image/jpg",
        "image/png",
        "image/gif",
        "image/webp"
    )

    /**
     * Processes a base64-encoded photo and returns the photo bytes and content type.
     * Supports both data URL format (e.g., "data:image/jpeg;base64,...") and raw base64.
     *
     * @param base64Photo The base64-encoded photo string
     * @return Pair of photo bytes and content type
     * @throws ResponseStatusException if the photo is invalid
     */
    fun processPhoto(base64Photo: String): Pair<ByteArray, String> {
        try {
            // Handle data URL format (e.g., "data:image/jpeg;base64,...")
            val photoData = if (base64Photo.startsWith("data:")) {
                val parts = base64Photo.split(",")
                if (parts.size != 2) {
                    throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid photo format")
                }

                // Extract content type from data URL
                val dataUrlPrefix = parts[0] // e.g., "data:image/jpeg;base64"
                val contentType = dataUrlPrefix.substringAfter("data:").substringBefore(";")

                // Validate content type
                validateContentType(contentType)

                val bytes = Base64.getDecoder().decode(parts[1])
                bytes to contentType
            } else {
                // Assume it's raw base64 without data URL prefix
                val bytes = Base64.getDecoder().decode(base64Photo)
                val contentType = detectContentType(bytes)
                validateContentType(contentType)
                bytes to contentType
            }

            // Validate size
            if (photoData.first.size > MAX_PHOTO_SIZE) {
                throw ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Photo size exceeds ${MAX_PHOTO_SIZE / 1024 / 1024}MB limit"
                )
            }

            return photoData
        } catch (e: IllegalArgumentException) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid base64 encoding", e)
        }
    }

    /**
     * Validates that the content type is allowed.
     */
    private fun validateContentType(contentType: String) {
        if (!ALLOWED_CONTENT_TYPES.contains(contentType.lowercase())) {
            throw ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "Invalid photo format. Allowed formats: JPEG, PNG, GIF, WEBP"
            )
        }
    }

    /**
     * Detects the content type from the photo bytes by examining the file header.
     */
    private fun detectContentType(bytes: ByteArray): String {
        return when {
            bytes.size >= 2 && bytes[0] == 0xFF.toByte() && bytes[1] == 0xD8.toByte() -> "image/jpeg"
            bytes.size >= 8 && bytes[0] == 0x89.toByte() && bytes[1] == 0x50.toByte() &&
                bytes[2] == 0x4E.toByte() && bytes[3] == 0x47.toByte() -> "image/png"
            bytes.size >= 6 && bytes[0] == 0x47.toByte() && bytes[1] == 0x49.toByte() &&
                bytes[2] == 0x46.toByte() -> "image/gif"
            bytes.size >= 12 && bytes[8] == 0x57.toByte() && bytes[9] == 0x45.toByte() &&
                bytes[10] == 0x42.toByte() && bytes[11] == 0x50.toByte() -> "image/webp"
            else -> "image/jpeg" // default fallback
        }
    }
}

