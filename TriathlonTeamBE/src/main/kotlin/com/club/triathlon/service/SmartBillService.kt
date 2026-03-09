package com.club.triathlon.service

import com.club.triathlon.domain.Invoice
import com.club.triathlon.domain.Payment
import com.club.triathlon.domain.User
import com.club.triathlon.enums.EnrollmentKind
import com.club.triathlon.enums.InvoiceStatus
import com.club.triathlon.enums.InvoiceType
import com.club.triathlon.enums.IssuerType
import com.club.triathlon.repo.ActivityRepository
import com.club.triathlon.repo.CampRepository
import com.club.triathlon.repo.CoachProfileRepository
import com.club.triathlon.repo.CourseRepository
import com.club.triathlon.repo.InvoiceRepository
import com.fasterxml.jackson.annotation.JsonProperty
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.http.HttpEntity
import org.springframework.http.HttpHeaders
import org.springframework.http.HttpMethod
import org.springframework.http.MediaType
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.client.RestTemplate
import java.math.BigDecimal
import java.math.RoundingMode
import java.time.LocalDate
import java.time.OffsetDateTime
import java.time.format.DateTimeFormatter
import java.util.Base64
import java.util.UUID

@Service
class SmartBillService(
    @Value("\${smartbill.api-url:https://ws.smartbill.ro/SPCG/rest}") private val apiUrl: String,
    @Value("\${smartbill.username:}") private val username: String,
    @Value("\${smartbill.token:}") private val token: String,
    @Value("\${smartbill.company-cif:}") private val platformCif: String,
    @Value("\${smartbill.series-name:FCT}") private val defaultSeriesName: String,
    @Value("\${smartbill.enabled:false}") private val enabled: Boolean,
    private val stripeConnectService: StripeConnectService,
    private val invoiceRepository: InvoiceRepository,
    private val coachProfileRepository: CoachProfileRepository,
    private val courseRepository: CourseRepository,
    private val campRepository: CampRepository,
    private val activityRepository: ActivityRepository
) {
    private val logger = LoggerFactory.getLogger(SmartBillService::class.java)
    private val restTemplate = RestTemplate()

    companion object {
        const val VAT_RATE = 19
        const val VAT_NAME = "Normala"
        private val DATE_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd")
    }

    /**
     * Check if SmartBill integration is enabled and configured
     */
    fun isConfigured(): Boolean {
        return enabled && username.isNotBlank() && token.isNotBlank() && platformCif.isNotBlank()
    }

    /**
     * Generate invoice after successful payment
     */
    @Transactional
    fun generateInvoice(payment: Payment, coach: User?): Invoice {
        val enrollment = payment.enrollment
        val profile = coach?.let { coachProfileRepository.findByUser(it) }
        val feeBreakdown = calculateFeeBreakdown(payment.amount)

        // Determine issuer based on coach company status
        val issuerType = if (profile?.shouldIssueCoachInvoice() == true) {
            IssuerType.COACH
        } else {
            IssuerType.PLATFORM
        }

        // Map enrollment kind to invoice type
        val invoiceType = when (enrollment.kind) {
            EnrollmentKind.COURSE -> InvoiceType.COURSE
            EnrollmentKind.CAMP -> InvoiceType.CAMP
            EnrollmentKind.ACTIVITY -> InvoiceType.ACTIVITY
        }

        // Create invoice record
        val invoice = Invoice().apply {
            this.payment = payment
            this.invoiceType = invoiceType
            this.issuerType = issuerType
            this.subtotal = feeBreakdown.subtotal
            this.vatAmount = feeBreakdown.vat
            this.totalAmount = payment.amount
            this.platformFee = feeBreakdown.platformFeeBase
            this.platformFeeVat = feeBreakdown.platformFeeVat
            this.coachAmount = feeBreakdown.coachAmount
            this.createdAt = OffsetDateTime.now()
            this.status = InvoiceStatus.PENDING
        }
        invoiceRepository.save(invoice)

        // If SmartBill is not configured, just save the invoice record
        if (!isConfigured()) {
            logger.warn("⚠️ SmartBill not configured - invoice record saved but not sent")
            return invoice
        }

        // Send to SmartBill
        try {
            val smartBillResponse = createSmartBillInvoice(invoice, payment, coach, profile)

            invoice.smartbillSeries = smartBillResponse.series
            invoice.smartbillNumber = smartBillResponse.number
            invoice.smartbillId = smartBillResponse.url
            invoice.status = InvoiceStatus.SENT
            invoice.sentAt = OffsetDateTime.now()

            logger.info("✅ SmartBill invoice created: ${invoice.getSmartBillReference()}")

        } catch (e: Exception) {
            logger.error("❌ Failed to create SmartBill invoice: ${e.message}", e)
            invoice.status = InvoiceStatus.FAILED
            invoice.errorMessage = e.message
        }

        return invoiceRepository.save(invoice)
    }

    /**
     * Retry failed invoice
     */
    @Transactional
    fun retryFailedInvoice(invoiceId: UUID): Invoice {
        val invoice = invoiceRepository.findById(invoiceId).orElseThrow {
            IllegalArgumentException("Invoice not found: $invoiceId")
        }

        if (invoice.status != InvoiceStatus.FAILED) {
            throw IllegalArgumentException("Can only retry failed invoices")
        }

        val payment = invoice.payment
        val enrollment = payment.enrollment
        val coach = when (enrollment.kind) {
            EnrollmentKind.COURSE -> courseRepository.findById(enrollment.entityId).orElse(null)?.coach
            EnrollmentKind.ACTIVITY -> activityRepository.findById(enrollment.entityId).orElse(null)?.coach
            EnrollmentKind.CAMP -> null
        }

        invoice.status = InvoiceStatus.PENDING
        invoice.errorMessage = null
        invoiceRepository.save(invoice)

        // Re-attempt SmartBill creation
        try {
            val profile = coach?.let { coachProfileRepository.findByUser(it) }
            val smartBillResponse = createSmartBillInvoice(invoice, payment, coach, profile)

            invoice.smartbillSeries = smartBillResponse.series
            invoice.smartbillNumber = smartBillResponse.number
            invoice.smartbillId = smartBillResponse.url
            invoice.status = InvoiceStatus.SENT
            invoice.sentAt = OffsetDateTime.now()

            logger.info("✅ Retried SmartBill invoice: ${invoice.getSmartBillReference()}")

        } catch (e: Exception) {
            logger.error("❌ Retry failed for SmartBill invoice: ${e.message}", e)
            invoice.status = InvoiceStatus.FAILED
            invoice.errorMessage = e.message
        }

        return invoiceRepository.save(invoice)
    }

    /**
     * Get invoice by payment ID
     */
    @Transactional(readOnly = true)
    fun getInvoiceByPaymentId(paymentId: UUID): Invoice? {
        return invoiceRepository.findByPaymentId(paymentId)
    }

    private fun createSmartBillInvoice(
        invoice: Invoice,
        payment: Payment,
        coach: User?,
        profile: com.club.triathlon.domain.CoachProfile?
    ): SmartBillInvoiceResponse {
        val enrollment = payment.enrollment
        val child = enrollment.child
        val parent = child.parent

        // Build client (parent who pays)
        val client = SmartBillClient(
            name = payment.billingName ?: parent.name,
            vatCode = "",  // PF doesn't have CUI
            address = payment.billingAddressLine1 ?: "",
            city = payment.billingCity ?: "",
            county = "",
            country = "Romania",
            email = payment.billingEmail ?: parent.email,
            phone = parent.phone ?: "",
            isTaxPayer = false
        )

        // Determine issuer CIF
        val issuerCif = if (invoice.issuerType == IssuerType.COACH && profile?.companyCui != null) {
            profile.companyCui!!
        } else {
            platformCif
        }

        // Build service name
        val serviceName = when (enrollment.kind) {
            EnrollmentKind.COURSE -> {
                val course = courseRepository.findById(enrollment.entityId).orElse(null)
                "Servicii antrenament - ${course?.name ?: "Curs"}"
            }
            EnrollmentKind.CAMP -> {
                val camp = campRepository.findById(enrollment.entityId).orElse(null)
                "Servicii antrenament - Tabără ${camp?.title ?: ""}"
            }
            EnrollmentKind.ACTIVITY -> {
                val activity = activityRepository.findById(enrollment.entityId).orElse(null)
                "Servicii antrenament - ${activity?.name ?: "Activitate"}"
            }
        }

        // Convert from bani to RON for SmartBill
        val priceInRon = BigDecimal.valueOf(invoice.subtotal)
            .divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP)
            .toDouble()

        val products = listOf(
            SmartBillProduct(
                name = serviceName,
                code = enrollment.entityId.toString().take(8).uppercase(),
                measuringUnitName = "buc",
                quantity = 1.0,
                price = priceInRon,
                isTaxIncluded = false,
                taxName = VAT_NAME,
                taxPercentage = VAT_RATE,
                currency = payment.currency
            )
        )

        val request = SmartBillInvoiceRequest(
            companyVatCode = issuerCif,
            client = client,
            issueDate = LocalDate.now().format(DATE_FORMATTER),
            seriesName = defaultSeriesName,
            isDraft = false,
            products = products,
            currency = payment.currency,
            language = "RO",
            useEFactura = true  // Enable e-Factura
        )

        val headers = HttpHeaders().apply {
            contentType = MediaType.APPLICATION_JSON
            val auth = Base64.getEncoder().encodeToString("$username:$token".toByteArray())
            set("Authorization", "Basic $auth")
        }

        val response = restTemplate.exchange(
            "$apiUrl/invoice",
            HttpMethod.POST,
            HttpEntity(request, headers),
            SmartBillInvoiceResponse::class.java
        )

        return response.body ?: throw RuntimeException("Empty response from SmartBill")
    }

    /**
     * Calculate fee breakdown from total amount (in bani)
     * Uses BigDecimal for precise financial calculations with HALF_UP rounding
     */
    private fun calculateFeeBreakdown(totalAmount: Long): FeeBreakdown {
        val totalBD = BigDecimal.valueOf(totalAmount)
        val vatMultiplier = BigDecimal("1.19")

        // Assume prices include VAT: Total = Subtotal * 1.19
        val subtotal = totalBD.divide(vatMultiplier, 0, RoundingMode.HALF_UP).toLong()
        val vat = totalAmount - subtotal

        // Platform fee breakdown should match Stripe Connect (source of truth for actual split)
        val fee = stripeConnectService.calculatePlatformFee(totalAmount)

        return FeeBreakdown(
            subtotal = subtotal,
            vat = vat,
            platformFeeBase = fee.platformFeeBase,
            platformFeeVat = fee.platformFeeVat,
            coachAmount = fee.coachAmount
        )
    }
}

// Internal DTOs
private data class FeeBreakdown(
    val subtotal: Long,
    val vat: Long,
    val platformFeeBase: Long,
    val platformFeeVat: Long,
    val coachAmount: Long
)

// SmartBill API DTOs
data class SmartBillClient(
    val name: String,
    val vatCode: String,
    val address: String,
    val city: String,
    val county: String,
    val country: String,
    val email: String,
    val phone: String,
    val isTaxPayer: Boolean = false
)

data class SmartBillProduct(
    val name: String,
    val code: String,
    val measuringUnitName: String,
    val quantity: Double,
    val price: Double,
    val isTaxIncluded: Boolean,
    val taxName: String,
    val taxPercentage: Int,
    val currency: String = "RON"
)

data class SmartBillInvoiceRequest(
    val companyVatCode: String,
    val client: SmartBillClient,
    val issueDate: String,
    val seriesName: String,
    val isDraft: Boolean,
    val products: List<SmartBillProduct>,
    val currency: String = "RON",
    val language: String = "RO",
    @JsonProperty("useEFactura")
    val useEFactura: Boolean = true
)

data class SmartBillInvoiceResponse(
    val series: String? = null,
    val number: String? = null,
    val url: String? = null,
    val errorText: String? = null
)
