package com.club.triathlon.config

import org.slf4j.LoggerFactory
import org.springframework.boot.autoconfigure.condition.ConditionalOnExpression
import org.springframework.boot.context.properties.ConfigurationProperties
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider
import software.amazon.awssdk.regions.Region
import software.amazon.awssdk.services.s3.S3Client
import software.amazon.awssdk.services.s3.presigner.S3Presigner
import java.net.URI

@ConfigurationProperties(prefix = "app.storage")
data class StorageProperties(
    val bucketName: String = "",
    val accessKey: String = "",
    val secretKey: String = "",
    val endpoint: String = "https://storage.railway.app",
    val region: String = "us-east-1",
    val presignedUrlExpiryMinutes: Long = 60
)

@Configuration
@ConditionalOnExpression("'\${app.storage.bucket-name:}' != ''")
class StorageConfig(private val properties: StorageProperties) {

    private val logger = LoggerFactory.getLogger(StorageConfig::class.java)

    @Bean
    fun s3Client(): S3Client {
        val credentials = AwsBasicCredentials.create(properties.accessKey, properties.secretKey)
        val client = S3Client.builder()
            .endpointOverride(URI.create(properties.endpoint))
            .credentialsProvider(StaticCredentialsProvider.create(credentials))
            .region(Region.of(properties.region))
            .forcePathStyle(false) // Railway uses virtual-hosted style
            .build()

        logger.info("S3 storage configured: bucket={}, endpoint={}", properties.bucketName, properties.endpoint)
        return client
    }

    @Bean
    fun s3Presigner(): S3Presigner {
        val credentials = AwsBasicCredentials.create(properties.accessKey, properties.secretKey)
        return S3Presigner.builder()
            .endpointOverride(URI.create(properties.endpoint))
            .credentialsProvider(StaticCredentialsProvider.create(credentials))
            .region(Region.of(properties.region))
            .build()
    }

    @Bean
    fun storageProperties(): StorageProperties = properties
}
