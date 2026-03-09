package com.club.triathlon.service.mail

import com.club.triathlon.service.public.ContactMessageRequest
import jakarta.mail.internet.InternetAddress
import org.slf4j.LoggerFactory
import org.springframework.core.env.Environment
import org.springframework.mail.SimpleMailMessage
import org.springframework.mail.MailAuthenticationException
import org.springframework.mail.javamail.JavaMailSender
import org.springframework.mail.javamail.JavaMailSenderImpl
import org.springframework.stereotype.Service

@Service
class MailService(
    private val mailSender: JavaMailSender,
    private val env: Environment
) {
    private val logger = LoggerFactory.getLogger(MailService::class.java)

    private fun mailEnabled(): Boolean = env.getProperty("app.mail.enabled", Boolean::class.java, false)
    private fun contactToAddress(): String = env.getProperty("app.mail.to", "office@motiontimisoara.com")

    private fun normalizeEmail(input: String?): String {
        if (input == null) return ""
        var s = input.trim()
        s = s.replace(Regex("^mailto:", RegexOption.IGNORE_CASE), "")
        s = s.removePrefix("<").removeSuffix(">")
        s = s.replace("\"", "")
        s = s.replace(Regex("\\s+"), "")
        return s
    }

    private fun isValidEmail(addr: String): Boolean {
        return try {
            InternetAddress(addr, true)
            true
        } catch (_: Exception) {
            false
        }
    }

    private fun mailSenderImpl(): JavaMailSenderImpl? = mailSender as? JavaMailSenderImpl

    fun sendContactMessage(request: ContactMessageRequest) {
        if (!mailEnabled()) {
            logger.info("Mail disabled. Skipping send for contact message from {} <{}>", request.name, request.email)
            return
        }
        try {
            val toRaw = contactToAddress()
            val to = normalizeEmail(toRaw)

            val ms = mailSenderImpl()
            if (ms != null) {
                logger.info(
                    "SMTP config: host={}, port={}, protocol={}, username={}, auth={}, starttls={}, ssl={}, debug={}",
                    ms.host, ms.port, ms.protocol, ms.username,
                    ms.javaMailProperties.getProperty("mail.smtp.auth"),
                    ms.javaMailProperties.getProperty("mail.smtp.starttls.enable"),
                    ms.javaMailProperties.getProperty("mail.smtp.ssl.enable"),
                    ms.javaMailProperties.getProperty("mail.debug")
                )
                try {
                    ms.testConnection()
                    logger.info("SMTP testConnection() OK for {}:{}", ms.host, ms.port)
                } catch (ex: Exception) {
                    logger.error("SMTP testConnection() FAILED for {}:{} - {}", ms.host, ms.port, ex.message)
                }
            } else {
                logger.info("MailSender implementation: {}", mailSender::class.java.name)
            }

            if (!isValidEmail(to)) {
                logger.error("Configured APP_MAIL_TO is not a valid email. Raw='{}' Normalized='{}'", toRaw, to)
                return
            }
            val subject = buildString {
                append("[Contact] ")
                if (!request.subject.isNullOrBlank()) append(request.subject) else append("Mesaj nou")
                append(" — ")
                append(request.name)
                append(" <")
                append(request.email)
                append(">")
            }
            val text = buildString {
                appendLine("Nume: ${request.name}")
                appendLine("Email: ${request.email}")
                if (!request.subject.isNullOrBlank()) appendLine("Subiect: ${request.subject}")
                appendLine()
                appendLine("Mesaj:")
                appendLine(request.message)
            }
            val msg = SimpleMailMessage().apply {
                setTo(to)
                setReplyTo(request.email)
                // Set explicit From equal with authenticated username if available
                mailSenderImpl()?.username?.let { setFrom(it) }
                this.subject = subject
                this.text = text
            }
            logger.info(
                "Attempting to send contact email: to='{}', from='{}', replyTo='{}', subjectLength={}, messageLength={}",
                to, msg.from ?: "(none)", request.email, subject.length, text.length
            )
            mailSender.send(msg)
            logger.info("Sent contact email to {} from {} <{}>", to, request.name, request.email)
        } catch (ex: MailAuthenticationException) {
            val ms = mailSenderImpl()
            logger.error(
                "SMTP authentication failed. host='{}' port={} username='{}'. {}",
                ms?.host, ms?.port, ms?.username, ex.message
            )
        } catch (ex: Exception) {
            logger.error("Failed to send contact email from {} <{}>", request.name, request.email, ex)
        }
    }

    fun sendPasswordResetEmail(toRaw: String, resetUrl: String, expirationMinutes: Long) {
        if (!mailEnabled()) {
            logger.info("Mail disabled. Skipping send for password reset email to {}", toRaw)
            return
        }

        try {
            val to = normalizeEmail(toRaw)

            if (!isValidEmail(to)) {
                logger.error("Cannot send password reset email. Invalid recipient address. Raw='{}' Normalized='{}'", toRaw, to)
                return
            }

            val subject = "Resetare parola - Motion Timisoara"
            val text = buildString {
                appendLine("Ai solicitat resetarea parolei pentru contul tau Motion Timisoara.")
                appendLine()
                appendLine("Pentru a seta o noua parola, acceseaza link-ul de mai jos:")
                appendLine(resetUrl)
                appendLine()
                appendLine("Link-ul este valabil aproximativ $expirationMinutes minute.")
                appendLine("Daca nu ai solicitat aceasta schimbare, poti ignora acest email.")
            }

            val msg = SimpleMailMessage().apply {
                setTo(to)
                mailSenderImpl()?.username?.let { setFrom(it) }
                this.subject = subject
                this.text = text
            }

            logger.info(
                "Attempting to send password reset email: to='{}', from='{}', subjectLength={}, messageLength={}",
                to, msg.from ?: "(none)", subject.length, text.length
            )

            mailSender.send(msg)
            logger.info("Sent password reset email to {}", to)
        } catch (ex: MailAuthenticationException) {
            val ms = mailSenderImpl()
            logger.error(
                "SMTP authentication failed while sending password reset email. host='{}' port={} username='{}'. {}",
                ms?.host, ms?.port, ms?.username, ex.message
            )
        } catch (ex: Exception) {
            logger.error("Failed to send password reset email to {}", toRaw, ex)
        }
    }
}

