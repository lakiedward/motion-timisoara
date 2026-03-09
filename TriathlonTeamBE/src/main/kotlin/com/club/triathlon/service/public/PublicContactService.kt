package com.club.triathlon.service.public

import com.club.triathlon.service.mail.MailService
import jakarta.validation.constraints.Email
import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.Size
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Service
import java.time.OffsetDateTime

@Service
class PublicContactService(
    private val mailService: MailService
) {

    private val logger = LoggerFactory.getLogger(PublicContactService::class.java)

    fun submitContact(request: ContactMessageRequest) {
        logger.info(
            "Received contact message at {} from {} <{}> with subject '{}' and body of {} characters",
            OffsetDateTime.now(),
            sanitize(request.name),
            sanitize(request.email),
            sanitize(request.subject ?: "(fara subiect)"),
            request.message.length
        )
        logger.debug("Contact message content: {}", request.message)
        mailService.sendContactMessage(request)
    }

    private fun sanitize(value: String): String {
        return value.replace("\n", " ").replace("\r", " ").trim()
    }
}

data class ContactMessageRequest(
    @field:NotBlank
    @field:Size(min = 2, max = 150)
    val name: String,
    @field:NotBlank
    @field:Email
    @field:Size(max = 160)
    val email: String,
    @field:Size(max = 180)
    val subject: String?,
    @field:NotBlank
    @field:Size(min = 10, max = 4000)
    val message: String
)
