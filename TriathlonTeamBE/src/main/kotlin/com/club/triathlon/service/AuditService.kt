package com.club.triathlon.service

import com.club.triathlon.domain.AuditLog
import com.club.triathlon.repo.AuditLogRepository
import com.fasterxml.jackson.databind.ObjectMapper
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Clock
import java.time.OffsetDateTime
import java.util.UUID

@Service
class AuditService(
    private val auditLogRepository: AuditLogRepository,
    private val clock: Clock,
    private val objectMapper: ObjectMapper
) {
    private val logger = LoggerFactory.getLogger(AuditService::class.java)

    companion object {
        /**
         * Maximum length for oldValue/newValue fields.
         * Matches the DB column size (VARCHAR(4000) or TEXT with app-level limit).
         */
        const val MAX_VALUE_LENGTH = 4000

        private val ALLOWED_METADATA_KEYS = setOf(
            "browser", "version", "platform", "device", "source",
            "session_id", "request_id", "correlation_id",
            "old_count", "new_count", "count", "reason", "type"
        )

        private const val MAX_METADATA_VALUE_LENGTH = 500

        private val EMAIL_PATTERN = Regex("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$")
        private val PHONE_PATTERN = Regex("^[+]?[0-9\\s\\-()]{7,15}$")
        private val SSN_PATTERN = Regex("^\\d{3}-?\\d{2}-?\\d{4}$")
    }

    @Transactional
    fun purgeOldLogs(retentionDays: Int) {
        if (retentionDays < 1) {
            throw IllegalArgumentException("retentionDays must be at least 1")
        }
        val cutoff = OffsetDateTime.now(clock).minusDays(retentionDays.toLong())
        val deleted = auditLogRepository.deleteByTimestampBefore(cutoff)
        logger.info("Purged {} audit logs older than {} days", deleted, retentionDays)
    }

    @Transactional(readOnly = true)
    fun findByActor(actorUserId: UUID): List<AuditLog> {
        return auditLogRepository.findByActorUserIdOrderByTimestampDesc(actorUserId)
    }

    @Transactional(readOnly = true)
    fun findByTarget(targetEntityId: UUID, targetEntityType: String): List<AuditLog> {
        return auditLogRepository.findByTargetEntityIdAndTargetEntityTypeOrderByTimestampDesc(
            targetEntityId,
            targetEntityType
        )
    }

    @Transactional
    fun logChange(
        actorUserId: UUID?,
        targetEntityId: UUID?,
        targetEntityType: String,
        action: String,
        fieldName: String? = null,
        oldValue: String? = null,
        newValue: String? = null,
        ipAddress: String? = null,
        metadata: Map<String, Any?>? = null
    ) {
        if (targetEntityId == null) {
            throw IllegalArgumentException("Target entity ID cannot be null")
        }
        
        // Normalize targetEntityType and action: trim whitespace and convert to uppercase for consistent storage
        val normalizedEntityType = targetEntityType.trim().uppercase()
        val normalizedAction = action.trim().uppercase()
        
        if (normalizedEntityType.isBlank()) {
            throw IllegalArgumentException("Target entity type cannot be null or blank")
        }
        if (normalizedAction.isBlank()) {
            throw IllegalArgumentException("Action cannot be null or blank")
        }

        val log = AuditLog().apply {
            this.actorUserId = actorUserId
            this.targetEntityId = targetEntityId
            this.targetEntityType = normalizedEntityType
            this.action = normalizedAction
            
            // Truncate and log if necessary
            this.fieldName = fieldName?.let {
                if (it.length > 255) {
                    this@AuditService.logger.warn("Truncating fieldName from ${it.length} to 255 chars")
                    it.take(255)
                } else it
            }
            
            this.oldValue = oldValue?.let {
                // Limit to MAX_VALUE_LENGTH chars as per application policy, log if truncated
                if (it.length > MAX_VALUE_LENGTH) {
                    this@AuditService.logger.warn("Truncating oldValue for field ${fieldName ?: "unknown"} from ${it.length} to $MAX_VALUE_LENGTH chars")
                    it.take(MAX_VALUE_LENGTH)
                } else it
            }
            
            this.newValue = newValue?.let {
                // Limit to MAX_VALUE_LENGTH chars as per application policy, log if truncated
                if (it.length > MAX_VALUE_LENGTH) {
                    this@AuditService.logger.warn("Truncating newValue for field ${fieldName ?: "unknown"} from ${it.length} to $MAX_VALUE_LENGTH chars")
                    it.take(MAX_VALUE_LENGTH)
                } else it
            }
            
            this.timestamp = OffsetDateTime.now(clock)
            
            this.ipAddress = ipAddress?.let {
                // IPv6 max length is 45 chars
                if (it.length > 45) {
                    this@AuditService.logger.warn("Truncating ipAddress from ${it.length} to 45 chars")
                    it.take(45)
                } else it
            }
            
            // Sanitize metadata before persisting
            this.metadata = sanitizeMetadata(metadata)
        }
        auditLogRepository.save(log)
    }

    /**
     * Sanitizes metadata map before persistence:
     * 1. Filters to allow-list of keys
     * 2. Converts non-string values to JSON strings
     * 3. Trims values to safe length
     * 4. Redacts values matching PII patterns (email, SSN, phone)
     */
    private fun sanitizeMetadata(metadata: Map<String, Any?>?): Map<String, Any>? {
        if (metadata == null) return null
        
        val sanitized = mutableMapOf<String, Any?>()
        
        for ((key, value) in metadata) {
            // Filter: only allow keys from allow-list
            if (key.lowercase() !in ALLOWED_METADATA_KEYS) {
                logger.debug("Dropping disallowed metadata key: $key")
                continue
            }
            
            // Convert value to string
            val stringValue: String? = when (value) {
                null -> null
                is String -> value
                else -> try {
                    objectMapper.writeValueAsString(value)
                } catch (e: Exception) {
                    logger.warn("Failed to serialize metadata value for key $key: ${e.message}")
                    value.toString()
                }
            }
            
            // Redact if PII pattern matches, then trim to safe length
            val finalValue = stringValue?.let { v ->
                val redacted = redactIfPii(v)
                if (redacted.length > MAX_METADATA_VALUE_LENGTH) {
                    logger.debug("Truncating metadata value for key $key from ${redacted.length} to $MAX_METADATA_VALUE_LENGTH chars")
                    redacted.take(MAX_METADATA_VALUE_LENGTH)
                } else {
                    redacted
                }
            }
            
            sanitized[key] = finalValue
        }
        
        @Suppress("UNCHECKED_CAST")
        return if (sanitized.isEmpty()) null else sanitized.filterValues { it != null } as Map<String, Any>
    }

    /**
     * Redacts values that match common PII patterns.
     */
    private fun redactIfPii(value: String): String {
        return when {
            EMAIL_PATTERN.matches(value) -> "[EMAIL_REDACTED]"
            PHONE_PATTERN.matches(value) -> "[PHONE_REDACTED]"
            SSN_PATTERN.matches(value) -> "[SSN_REDACTED]"
            else -> value
        }
    }

    @Transactional
    fun logConsentChange(
        clubId: UUID,
        actorUserId: UUID,
        oldValue: Boolean,
        newValue: Boolean,
        ipAddress: String? = null
    ) {
        logChange(
            actorUserId = actorUserId,
            targetEntityId = clubId,
            targetEntityType = "CLUB",
            action = "CONSENT_CHANGE",
            fieldName = "publicEmailConsent",
            oldValue = oldValue.toString(),
            newValue = newValue.toString(),
            ipAddress = ipAddress
        )
    }

    @Transactional
    fun logDsarRequest(
        actorUserId: UUID,
        requestType: String,
        ipAddress: String? = null
    ) {
        logChange(
            actorUserId = actorUserId,
            targetEntityId = actorUserId,
            targetEntityType = "USER",
            action = "DSAR_REQUEST",
            fieldName = "request_type",
            oldValue = null,
            newValue = requestType,
            ipAddress = ipAddress
        )
    }
}
