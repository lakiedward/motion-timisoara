package com.club.triathlon.service.storage

import com.club.triathlon.config.StorageProperties
import org.slf4j.LoggerFactory
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean
import org.springframework.stereotype.Service
import software.amazon.awssdk.core.sync.RequestBody
import software.amazon.awssdk.services.s3.S3Client
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest
import software.amazon.awssdk.services.s3.model.DeleteObjectsRequest
import software.amazon.awssdk.services.s3.model.Delete
import software.amazon.awssdk.services.s3.model.GetObjectRequest
import software.amazon.awssdk.services.s3.model.ObjectIdentifier
import software.amazon.awssdk.services.s3.model.PutObjectRequest
import software.amazon.awssdk.services.s3.presigner.S3Presigner
import software.amazon.awssdk.services.s3.presigner.model.GetObjectPresignRequest
import java.io.InputStream
import java.time.Duration
import java.util.UUID

@Service
@ConditionalOnBean(S3Client::class)
class StorageService(
    private val s3Client: S3Client,
    private val s3Presigner: S3Presigner,
    private val properties: StorageProperties
) {

    private val logger = LoggerFactory.getLogger(StorageService::class.java)

    fun upload(key: String, data: ByteArray, contentType: String): String {
        val request = PutObjectRequest.builder()
            .bucket(properties.bucketName)
            .key(key)
            .contentType(contentType)
            .build()

        s3Client.putObject(request, RequestBody.fromBytes(data))
        logger.debug("Uploaded {} ({} bytes) to S3", key, data.size)
        return key
    }

    fun upload(key: String, inputStream: InputStream, contentLength: Long, contentType: String): String {
        val request = PutObjectRequest.builder()
            .bucket(properties.bucketName)
            .key(key)
            .contentType(contentType)
            .contentLength(contentLength)
            .build()

        s3Client.putObject(request, RequestBody.fromInputStream(inputStream, contentLength))
        logger.debug("Uploaded {} ({} bytes, streamed) to S3", key, contentLength)
        return key
    }

    fun download(key: String): Pair<ByteArray, String> {
        val request = GetObjectRequest.builder()
            .bucket(properties.bucketName)
            .key(key)
            .build()

        val response = s3Client.getObject(request)
        val contentType = response.response().contentType() ?: "application/octet-stream"
        val bytes = response.readAllBytes()
        return Pair(bytes, contentType)
    }

    fun delete(key: String) {
        val request = DeleteObjectRequest.builder()
            .bucket(properties.bucketName)
            .key(key)
            .build()

        s3Client.deleteObject(request)
        logger.debug("Deleted {} from S3", key)
    }

    fun deleteAll(keys: List<String>) {
        if (keys.isEmpty()) return

        val objectIds = keys.map { ObjectIdentifier.builder().key(it).build() }
        val deleteRequest = DeleteObjectsRequest.builder()
            .bucket(properties.bucketName)
            .delete(Delete.builder().objects(objectIds).build())
            .build()

        s3Client.deleteObjects(deleteRequest)
        logger.debug("Deleted {} objects from S3", keys.size)
    }

    fun generatePresignedUrl(key: String, expiryMinutes: Long = properties.presignedUrlExpiryMinutes): String {
        val getObjectRequest = GetObjectRequest.builder()
            .bucket(properties.bucketName)
            .key(key)
            .build()

        val presignRequest = GetObjectPresignRequest.builder()
            .signatureDuration(Duration.ofMinutes(expiryMinutes))
            .getObjectRequest(getObjectRequest)
            .build()

        return s3Presigner.presignGetObject(presignRequest).url().toString()
    }

    fun generateObjectKey(prefix: String, contentType: String): String {
        val extension = extensionForContentType(contentType)
        return "$prefix/${UUID.randomUUID()}.$extension"
    }

    private fun extensionForContentType(contentType: String): String = when (contentType.lowercase()) {
        "image/jpeg", "image/jpg" -> "jpg"
        "image/png" -> "png"
        "image/gif" -> "gif"
        "image/webp" -> "webp"
        "video/mp4" -> "mp4"
        "video/webm" -> "webm"
        "video/quicktime" -> "mov"
        else -> "bin"
    }
}
