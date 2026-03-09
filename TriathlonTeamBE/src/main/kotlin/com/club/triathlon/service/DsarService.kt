package com.club.triathlon.service

import com.club.triathlon.domain.AuditLog
import com.club.triathlon.exception.EntityNotFoundException
import com.club.triathlon.repo.UserRepository
import com.club.triathlon.util.IpDetectionUtils
import com.fasterxml.jackson.databind.ObjectMapper
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.security.MessageDigest
import java.time.Clock
import java.time.OffsetDateTime
import java.util.UUID

@Service
class DsarService(
    private val auditService: AuditService,
    private val userRepository: UserRepository,
    private val objectMapper: ObjectMapper,
    private val clock: Clock,
    @Value("\${app.audit.retention-days:365}") private val retentionDays: Int
) {
    private val piiFieldNameKeywords = setOf(
        "name",
        "first_name",
        "firstname",
        "last_name",
        "lastname",
        "middle_name",
        "birthdate",
        "dob",
        "date_of_birth",
        "email",
        "phone",
        "password",
        "iban",
        "bank",
        "cnp",
        "government",
        "address",
        "card",
        "cvv",
        "ip",
        "ipaddress",
        "ip_address"
    )

    private val piiMetadataKeyKeywords = setOf(
        "email",
        "phone",
        "iban",
        "cnp",
        "address",
        "ip",
        "stripe",
        "payment",
        "card"
    )

    @Transactional
    fun submitDsarRequest(userId: UUID, requestType: String, ipAddress: String?) {
        if (!userRepository.existsById(userId)) {
            throw EntityNotFoundException("User not found")
        }

        auditService.logDsarRequest(
            actorUserId = userId,
            requestType = requestType,
            ipAddress = ipAddress
        )
    }

    @Transactional(readOnly = true)
    fun exportAuditForSubject(actorUserId: UUID, format: DsarExportFormat): DsarExportPayload {
        if (retentionDays < 1) {
            throw IllegalArgumentException("retentionDays must be at least 1")
        }

        val cutoff = OffsetDateTime.now(clock).minusDays(retentionDays.toLong())

        // Fetch logs where user is the actor
        val actorLogs = auditService.findByActor(actorUserId)
        
        // Fetch logs where user is the target (e.g., admin actions on user)
        val targetLogs = auditService.findByTarget(actorUserId, "USER")
        
        // Merge, deduplicate by ID, filter by cutoff, sort by timestamp
        val mergedLogs = (actorLogs + targetLogs)
            .distinctBy { it.id }
            .filter { it.timestamp >= cutoff }
            .sortedByDescending { it.timestamp }
            .map { pseudonymizeAuditEntry(it, actorUserId) }

        return when (format) {
            DsarExportFormat.JSON -> {
                val bytes = objectMapper.writeValueAsBytes(mergedLogs)
                DsarExportPayload(
                    bytes = bytes,
                    contentType = "application/json",
                    fileName = "dsar_audit_${actorUserId}.json"
                )
            }

            DsarExportFormat.CSV -> {
                val csv = buildCsv(mergedLogs)
                DsarExportPayload(
                    bytes = csv.toByteArray(Charsets.UTF_8),
                    contentType = "text/csv; charset=utf-8",
                    fileName = "dsar_audit_${actorUserId}.csv"
                )
            }
        }
    }

    /**
     * Pseudonymizes an audit entry for export.
     * - Redacts target entity ID if it refers to another user.
     * - Redacts PII in oldValue/newValue based on fieldName.
     */
    private fun pseudonymizeAuditEntry(log: AuditLog, subjectUserId: UUID): DsarAuditEntry {
        val targetEntityId = if (
            log.targetEntityType.equals("USER", ignoreCase = true) && log.targetEntityId != subjectUserId
        ) {
            "[REDACTED]"
        } else {
            log.targetEntityId.toString()
        }

        val redactedMetadata = redactMetadata(log.metadata)

        return DsarAuditEntry(
            timestamp = log.timestamp,
            action = log.action,
            targetEntityType = log.targetEntityType,
            targetEntityId = targetEntityId,
            fieldName = log.fieldName,
            oldValue = redactPii(log.fieldName, log.oldValue),
            newValue = redactPii(log.fieldName, log.newValue),
            ipAddress = "[REDACTED]",
            metadata = redactedMetadata
        )
    }

    private fun redactPii(fieldName: String?, value: String?): String? {
        if (value == null) return null

        if (fieldName != null && piiFieldNameKeywords.any { fieldName.contains(it, ignoreCase = true) }) {
            return "[REDACTED]"
        }

        // Check for payment identifiers first to prefer pseudonymization over generic redaction
        if (looksLikePaymentIdentifier(value)) {
            return pseudonymize(value)
        }

        if (isProbablySensitive(value)) {
            return "[REDACTED]"
        }

        return value
    }

    private fun isProbablySensitive(value: String): Boolean {
        return looksLikeEmail(value) || 
               looksLikeIp(value) || 
               looksLikePhone(value) || 
               looksLikeIban(value) || 
               looksLikeCnp(value)
    }

    private fun redactMetadata(metadata: Map<String, Any>?): Map<String, Any>? {
        if (metadata == null) return null
        @Suppress("UNCHECKED_CAST")
        return processRedaction(metadata) as? Map<String, Any>
    }

    private fun processRedaction(value: Any?): Any? {
        if (value == null) return null

        return when (value) {
            is Map<*, *> -> {
                val result = mutableMapOf<String, Any?>()
                for ((k, v) in value) {
                    val key = k.toString()
                    val isSensitiveKey = piiMetadataKeyKeywords.any { key.contains(it, ignoreCase = true) }

                    if (isSensitiveKey) {
                        result[key] = "[REDACTED]"
                    } else {
                        // Pass key for string values to allow keyword matching
                        if (v is String) {
                            result[key] = redactPii(key, v)
                        } else {
                            result[key] = processRedaction(v)
                        }
                    }
                }
                result
            }
            is Collection<*> -> processElements(value)
            is Array<*> -> processElements(value.toList())
            is String -> redactPii(null, value)
            else -> value
        }
    }

    private fun processElements(elements: Iterable<*>): List<Any?> {
        return elements.map {
            if (it is String) redactPii(null, it) else processRedaction(it)
        }
    }

    private fun buildCsv(entries: List<DsarAuditEntry>): String {
        val sb = StringBuilder()
        sb.append(
            listOf(
                "timestamp",
                "action",
                "targetEntityType",
                "targetEntityId",
                "fieldName",
                "oldValue",
                "newValue",
                "ipAddress",
                "metadata"
            ).joinToString(",")
        )
        sb.append("\n")

        for (e in entries) {
            val metadataJson = e.metadata?.let { objectMapper.writeValueAsString(it) }
            val row = listOf(
                e.timestamp.toString(),
                e.action,
                e.targetEntityType,
                e.targetEntityId,
                e.fieldName,
                e.oldValue,
                e.newValue,
                e.ipAddress,
                metadataJson
            ).joinToString(",") { csvEscape(it) }
            sb.append(row).append("\n")
        }

        return sb.toString()
    }

    private fun csvEscape(value: String?): String {
        val v = value ?: ""
        val needsQuotes = v.contains(',') || v.contains('"') || v.contains('\n') || v.contains('\r')
        if (!needsQuotes) return v
        return "\"" + v.replace("\"", "\"\"") + "\""
    }

    private fun looksLikeEmail(value: String): Boolean {
        return Regex("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$").matches(value)
    }

    private fun looksLikeIp(value: String): Boolean {
        return IpDetectionUtils.looksLikeIp(value)
    }

    private fun looksLikePhone(value: String): Boolean {
        val v = value.trim()
        
        // Allow digits, whitespace, dash, parens and plus
        if (!Regex("^[0-9\\s\\-()+]+$").matches(v)) {
            return false
        }
        
        // Normalize digits
        val digits = v.filter { it.isDigit() }
        
        // Check digit count constraint
        return digits.length in 7..15
    }

    /**
     * Lightweight heuristic for PII detection only. Not a full IBAN validator.
     */
    private fun looksLikeIban(value: String): Boolean {
        return Regex("^[A-Z]{2}\\d{2}[A-Z0-9]{11,30}$").matches(value.replace(" ", "").uppercase())
    }

    /**
     * Lightweight heuristic for PII detection only. Not a full CNP validator.
     */
    private fun looksLikeCnp(value: String): Boolean {
        return Regex("^\\d{13}$").matches(value)
    }

    /**
     * Lightweight heuristic for PII detection only. Not a full payment identifier validator.
     */
    private fun looksLikePaymentIdentifier(value: String): Boolean {
        return value.startsWith("pi_") || value.startsWith("pm_") || value.startsWith("ch_") || value.startsWith("cus_")
    }

    private fun pseudonymize(value: String): String {
        val digest = MessageDigest.getInstance("SHA-256").digest(value.toByteArray(Charsets.UTF_8))
        val hex = digest.joinToString("") { b -> "%02x".format(b) }
        return "PSEUDONYM_${hex.take(12)}"
    }
}

enum class DsarExportFormat {
    JSON,
    CSV
}

data class DsarExportPayload(
    val bytes: ByteArray,
    val contentType: String,
    val fileName: String
) {
    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (javaClass != other?.javaClass) return false

        other as DsarExportPayload

        if (!bytes.contentEquals(other.bytes)) return false
        if (contentType != other.contentType) return false
        if (fileName != other.fileName) return false

        return true
    }

    override fun hashCode(): Int {
        var result = bytes.contentHashCode()
        result = 31 * result + contentType.hashCode()
        result = 31 * result + fileName.hashCode()
        return result
    }
}

data class DsarAuditEntry(
    val timestamp: OffsetDateTime,
    val action: String,
    val targetEntityType: String,
    val targetEntityId: String,
    val fieldName: String?,
    val oldValue: String?,
    val newValue: String?,
    val ipAddress: String,
    val metadata: Map<String, Any>?
)
