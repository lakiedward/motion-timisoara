package com.club.triathlon.web

import jakarta.validation.ValidationException
import org.slf4j.LoggerFactory
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.security.access.AccessDeniedException
import org.springframework.validation.FieldError
import org.springframework.web.bind.MethodArgumentNotValidException
import org.springframework.web.bind.annotation.ExceptionHandler
import org.springframework.web.bind.annotation.RestControllerAdvice
import org.springframework.web.server.ResponseStatusException
import java.time.Instant

@RestControllerAdvice
class GlobalExceptionHandler {
    
    private val logger = LoggerFactory.getLogger(GlobalExceptionHandler::class.java)

    @ExceptionHandler(MethodArgumentNotValidException::class)
    fun handleValidation(ex: MethodArgumentNotValidException): ResponseEntity<ApiError> {
        val errors = ex.bindingResult.allErrors.mapNotNull { error ->
            if (error is FieldError) {
                "${'$'}{error.field}: ${'$'}{error.defaultMessage}"
            } else {
                error.defaultMessage
            }
        }
        
        logger.warn("⚠️ [ERROR] Validation failed: ${errors.joinToString(", ")}")
        return buildResponse(HttpStatus.BAD_REQUEST, "Validation failed", errors)
    }

    @ExceptionHandler(com.club.triathlon.exception.EntityNotFoundException::class)
    fun handleEntityNotFound(ex: com.club.triathlon.exception.EntityNotFoundException): ResponseEntity<ApiError> {
        logger.warn("🔍 [ERROR] Entity not found: ${ex.message}")
        return buildResponse(HttpStatus.NOT_FOUND, ex.message ?: "Entity not found")
    }

    @ExceptionHandler(ValidationException::class, IllegalArgumentException::class)
    fun handleBadRequest(ex: Exception): ResponseEntity<ApiError> {
        logger.warn("⚠️ [ERROR] Bad request: ${ex.message}")
        return buildResponse(HttpStatus.BAD_REQUEST, ex.message ?: "Bad request")
    }

    @ExceptionHandler(AccessDeniedException::class)
    fun handleAccessDenied(ex: AccessDeniedException): ResponseEntity<ApiError> {
        logger.warn("🚫 [ERROR] Access denied: ${ex.message}")
        return buildResponse(HttpStatus.FORBIDDEN, ex.message ?: "Access denied")
    }

    @ExceptionHandler(ResponseStatusException::class)
    fun handleResponseStatus(ex: ResponseStatusException): ResponseEntity<ApiError> {
        val status = HttpStatus.resolve(ex.statusCode.value()) ?: HttpStatus.INTERNAL_SERVER_ERROR
        logger.error("❌ [ERROR] Response status exception: ${ex.reason ?: "An error occurred"}")
        return buildResponse(status, ex.reason ?: "An error occurred")
    }

    @ExceptionHandler(Exception::class)
    fun handleGenericException(ex: Exception): ResponseEntity<ApiError> {
        logger.error("💥 [ERROR] Unexpected error: ${ex.message}", ex)
        return buildResponse(HttpStatus.INTERNAL_SERVER_ERROR, "A apărut o eroare neașteptată. Vă rugăm încercați din nou.")
    }

    private fun buildResponse(status: HttpStatus, message: String, errors: List<String>? = null): ResponseEntity<ApiError> {
        val body = ApiError(
            status = status.value(),
            message = message,
            errors = errors,
            timestamp = Instant.now()
        )
        return ResponseEntity.status(status).body(body)
    }
}

data class ApiError(
    val status: Int,
    val message: String,
    val errors: List<String>? = null,
    val timestamp: Instant
)