package com.club.triathlon.scheduler

import com.club.triathlon.service.AuditService
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.scheduling.annotation.Scheduled
import org.springframework.stereotype.Component

@Component
class AuditLogScheduler(
    private val auditService: AuditService,
    @Value("\${app.audit.retention-days:365}") private val retentionDays: Int
) {
    private val logger = LoggerFactory.getLogger(AuditLogScheduler::class.java)

    @Scheduled(cron = "0 0 2 * * *") // Every day at 2 AM
    fun purgeOldLogs() {
        logger.info("Starting scheduled audit log purge (retention: $retentionDays days)")
        try {
            auditService.purgeOldLogs(retentionDays)
            logger.info("Audit log purge completed successfully")
        } catch (e: Exception) {
            logger.error("Failed to purge old audit logs: ${e.message}", e)
        }
    }
}
