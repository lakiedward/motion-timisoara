package com.club.triathlon.web.admin

import com.club.triathlon.service.storage.DataMigrationService
import com.club.triathlon.service.storage.MigrationStatus
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/admin/migration")
class AdminDataMigrationController {

    @Autowired(required = false)
    private var dataMigrationService: DataMigrationService? = null

    @PostMapping("/media-to-s3")
    fun migrateMediaToS3(): ResponseEntity<Map<String, String>> {
        val service = dataMigrationService
            ?: return ResponseEntity.badRequest().body(mapOf("error" to "S3 storage not configured"))

        if (service.getStatus().running) {
            return ResponseEntity.badRequest().body(mapOf("error" to "Migration already running"))
        }

        // Run in a separate thread to not block the request
        Thread { service.migrateAll() }.start()

        return ResponseEntity.ok(mapOf("message" to "Migration started"))
    }

    @GetMapping("/media-to-s3/status")
    fun getMigrationStatus(): ResponseEntity<MigrationStatus> {
        val service = dataMigrationService
            ?: return ResponseEntity.ok(MigrationStatus(
                running = false,
                totalMigrated = 0,
                totalSkipped = 0,
                totalErrors = 0,
                details = mapOf("error" to -1)
            ))

        return ResponseEntity.ok(service.getStatus())
    }
}
