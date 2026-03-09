package com.club.triathlon.service.storage

import org.slf4j.LoggerFactory
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean
import org.springframework.stereotype.Service
import software.amazon.awssdk.services.s3.S3Client
import java.io.InputStream

@Service
@ConditionalOnMissingBean(S3Client::class)
class NoOpStorageService {

    private val logger = LoggerFactory.getLogger(NoOpStorageService::class.java)

    init {
        logger.warn("S3 storage not configured - media uploads will use database storage. Set BUCKET_NAME, BUCKET_ACCESS_KEY, BUCKET_SECRET_KEY to enable S3.")
    }
}
