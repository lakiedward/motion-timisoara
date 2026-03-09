package com.club.triathlon.service

import com.club.triathlon.domain.AuditLog
import com.club.triathlon.repo.AuditLogRepository
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import com.fasterxml.jackson.databind.ObjectMapper
import org.mockito.ArgumentCaptor
import org.mockito.kotlin.mock
import org.mockito.kotlin.verify
import java.time.Clock
import java.time.Instant
import java.time.OffsetDateTime
import java.time.ZoneId
import java.util.UUID

class AuditServiceTest {

    private val auditLogRepository: AuditLogRepository = mock()
    private lateinit var auditService: AuditService
    private lateinit var fixedClock: Clock

    @BeforeEach
    fun setup() {
        // Fixed time: 2026-01-01T10:00:00Z
        fixedClock = Clock.fixed(Instant.parse("2026-01-01T10:00:00Z"), ZoneId.of("UTC"))
        auditService = AuditService(auditLogRepository, fixedClock, ObjectMapper())
    }

    @Test
    fun `logChange saves audit log with correct timestamp`() {
        val actorId = UUID.randomUUID()
        val targetId = UUID.randomUUID()

        auditService.logChange(
            actorUserId = actorId,
            targetEntityId = targetId,
            targetEntityType = "CLUB",
            action = "UPDATE",
            fieldName = "name",
            oldValue = "Old Name",
            newValue = "New Name",
            ipAddress = "127.0.0.1"
        )

        val captor = ArgumentCaptor.forClass(AuditLog::class.java)
        verify(auditLogRepository).save(captor.capture())

        val savedLog = captor.value
        assertEquals(actorId, savedLog.actorUserId)
        assertEquals(targetId, savedLog.targetEntityId)
        assertEquals("CLUB", savedLog.targetEntityType)
        assertEquals("UPDATE", savedLog.action)
        assertEquals("name", savedLog.fieldName)
        assertEquals("Old Name", savedLog.oldValue)
        assertEquals("New Name", savedLog.newValue)
        assertEquals("127.0.0.1", savedLog.ipAddress)
        
        // Verify timestamp comes from our fixed clock
        assertNotNull(savedLog.timestamp)
        assertEquals(Instant.now(fixedClock), savedLog.timestamp.toInstant())
    }

    @Test
    fun `logChange saves audit log with null actorUserId`() {
        val targetId = UUID.randomUUID()

        auditService.logChange(
            actorUserId = null,
            targetEntityId = targetId,
            targetEntityType = "SYSTEM",
            action = "AUTO_CLEANUP"
        )

        val captor = ArgumentCaptor.forClass(AuditLog::class.java)
        verify(auditLogRepository).save(captor.capture())

        val savedLog = captor.value
        assertEquals(null, savedLog.actorUserId)
        assertEquals(targetId, savedLog.targetEntityId)
        assertEquals("SYSTEM", savedLog.targetEntityType)
        assertEquals("AUTO_CLEANUP", savedLog.action)
    }

    @Test
    fun `logChange saves audit log with metadata`() {
        val actorId = UUID.randomUUID()
        val targetId = UUID.randomUUID()
        val metadata = mapOf("browser" to "Chrome", "version" to "1.0")

        auditService.logChange(
            actorUserId = actorId,
            targetEntityId = targetId,
            targetEntityType = "CLUB",
            action = "UPDATE",
            metadata = metadata
        )

        val captor = ArgumentCaptor.forClass(AuditLog::class.java)
        verify(auditLogRepository).save(captor.capture())

        val savedLog = captor.value
        assertEquals(metadata, savedLog.metadata)
    }

    @Test
    fun `logChange throws exception when targetEntityType is blank`() {
        assertThrows(IllegalArgumentException::class.java) {
            auditService.logChange(
                actorUserId = UUID.randomUUID(),
                targetEntityId = UUID.randomUUID(),
                targetEntityType = "  ",
                action = "UPDATE"
            )
        }
    }

    @Test
    fun `logChange throws exception when action is blank`() {
        assertThrows(IllegalArgumentException::class.java) {
            auditService.logChange(
                actorUserId = UUID.randomUUID(),
                targetEntityId = UUID.randomUUID(),
                targetEntityType = "CLUB",
                action = ""
            )
        }
    }

    @Test
    fun `purgeOldLogs deletes logs older than retention period`() {
        val days = 30
        auditService.purgeOldLogs(days)
        
        val captor = ArgumentCaptor.forClass(OffsetDateTime::class.java)
        verify(auditLogRepository).deleteByTimestampBefore(captor.capture())
        
        val expectedCutoff = OffsetDateTime.now(fixedClock).minusDays(days.toLong())
        assertEquals(expectedCutoff, captor.value)
    }

    @Test
    fun `purgeOldLogs throws exception when retention days is zero`() {
        val exception = assertThrows(IllegalArgumentException::class.java) {
            auditService.purgeOldLogs(0)
        }
        assertEquals("retentionDays must be at least 1", exception.message)
    }

    @Test
    fun `purgeOldLogs throws exception when retention days is negative`() {
        val exception = assertThrows(IllegalArgumentException::class.java) {
            auditService.purgeOldLogs(-1)
        }
        assertEquals("retentionDays must be at least 1", exception.message)
    }

    @Test
    fun `logChange throws exception when targetEntityId is null`() {
        // Since Kotlin's non-nullable types usually prevent this at compile-time, 
        // we test it for cases where it might be called from Java or via reflection.
        assertThrows(IllegalArgumentException::class.java) {
            @Suppress("UNCHECKED_CAST")
            auditService.logChange(
                actorUserId = UUID.randomUUID(),
                targetEntityId = null,
                targetEntityType = "CLUB",
                action = "UPDATE"
            )
        }
    }

    @Test
    fun `logChange handles excessively long strings by truncating`() {
        // Create a string longer than MAX_VALUE_LENGTH chars
        val longString = "a".repeat(AuditService.MAX_VALUE_LENGTH + 2000)
        val targetId = UUID.randomUUID()
        
        auditService.logChange(
            actorUserId = null,
            targetEntityId = targetId,
            targetEntityType = "TEST",
            action = "TEST_LONG",
            oldValue = longString
        )
        
        val captor = ArgumentCaptor.forClass(AuditLog::class.java)
        verify(auditLogRepository).save(captor.capture())
        
        // Assert truncation at MAX_VALUE_LENGTH chars
        assertEquals(AuditService.MAX_VALUE_LENGTH, captor.value.oldValue?.length)
        assertEquals(longString.substring(0, AuditService.MAX_VALUE_LENGTH), captor.value.oldValue)
    }

    @Test
    fun `logChange stores special characters without modification`() {
        // Verifies persistence of special characters via auditService.logChange (not SQL injection prevention)
        val injection = "'; DROP TABLE users; --"
        val targetId = UUID.randomUUID()
        
        auditService.logChange(
            actorUserId = null,
            targetEntityId = targetId,
            targetEntityType = "TEST",
            action = "TEST_INJECTION",
            newValue = injection
        )
        
        val captor = ArgumentCaptor.forClass(AuditLog::class.java)
        verify(auditLogRepository).save(captor.capture())
        assertEquals(injection, captor.value.newValue)
    }

    @Test
    fun `findByActor returns logs from repository`() {
        val actorId = UUID.randomUUID()
        val logs = listOf(buildAuditLog(actorUserId = actorId))
        org.mockito.kotlin.whenever(auditLogRepository.findByActorUserIdOrderByTimestampDesc(actorId))
            .thenReturn(logs)
        
        val result = auditService.findByActor(actorId)
        assertEquals(1, result.size)
        assertEquals(actorId, result[0].actorUserId)
    }

    @Test
    fun `findByTarget returns logs from repository`() {
        val targetId = UUID.randomUUID()
        val type = "CLUB"
        val logs = listOf(buildAuditLog(targetEntityId = targetId, targetEntityType = type))
        org.mockito.kotlin.whenever(auditLogRepository.findByTargetEntityIdAndTargetEntityTypeOrderByTimestampDesc(targetId, type))
            .thenReturn(logs)
        
        val result = auditService.findByTarget(targetId, type)
        assertEquals(1, result.size)
        assertEquals(targetId, result[0].targetEntityId)
    }

    private fun buildAuditLog(
        actorUserId: UUID? = null,
        targetEntityId: UUID = UUID.randomUUID(),
        targetEntityType: String = "TEST",
        action: String = "TEST",
        timestamp: OffsetDateTime = OffsetDateTime.now(fixedClock)
    ): AuditLog {
        return AuditLog().apply {
            this.actorUserId = actorUserId
            this.targetEntityId = targetEntityId
            this.targetEntityType = targetEntityType
            this.action = action
            this.timestamp = timestamp
        }
    }

    @Test
    fun `logChange handles concurrent calls`() {
        // Assume AuditService has no mutable shared state to corrupt
        val targetId = UUID.randomUUID()
        val threads = 10
        val latch = java.util.concurrent.CountDownLatch(threads)
        val executor = java.util.concurrent.Executors.newFixedThreadPool(threads)
        var latchCompleted = false
        
        try {
            repeat(threads) {
                executor.submit {
                    try {
                        auditService.logChange(
                            actorUserId = null,
                            targetEntityId = targetId,
                            targetEntityType = "CONCURRENCY_TEST",
                            action = "TEST"
                        )
                    } finally {
                        latch.countDown()
                    }
                }
            }
            
            latchCompleted = latch.await(5, java.util.concurrent.TimeUnit.SECONDS)
            if (!latchCompleted) {
                throw java.util.concurrent.TimeoutException("Test timed out waiting for threads")
            }
            verify(auditLogRepository, org.mockito.kotlin.times(threads)).save(org.mockito.kotlin.any())
        } finally {
            // Always clean up executor, even if latch timed out or verification failed
            if (!latchCompleted) {
                executor.shutdownNow()
            } else {
                executor.shutdown()
            }
            executor.awaitTermination(2, java.util.concurrent.TimeUnit.SECONDS)
        }
    }
}
