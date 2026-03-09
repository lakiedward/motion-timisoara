package com.club.triathlon.repo

import com.club.triathlon.domain.Invoice
import com.club.triathlon.domain.Payment
import com.club.triathlon.enums.InvoiceStatus
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import java.time.OffsetDateTime
import java.util.UUID

interface InvoiceRepository : JpaRepository<Invoice, UUID> {
    
    fun findByPayment(payment: Payment): Invoice?
    
    fun findByPaymentId(paymentId: UUID): Invoice?
    
    fun findByStatus(status: InvoiceStatus): List<Invoice>
    
    fun findBySmartbillId(smartbillId: String): Invoice?
    
    fun findByAnafIndex(anafIndex: String): Invoice?
    
    @Query("""
        SELECT i FROM Invoice i 
        WHERE i.status = :status 
        ORDER BY i.createdAt ASC
    """)
    fun findPendingInvoices(status: InvoiceStatus = InvoiceStatus.PENDING): List<Invoice>
    
    @Query("""
        SELECT i FROM Invoice i 
        WHERE i.createdAt BETWEEN :startDate AND :endDate 
        ORDER BY i.createdAt DESC
    """)
    fun findByDateRange(startDate: OffsetDateTime, endDate: OffsetDateTime): List<Invoice>
    
    @Query("""
        SELECT SUM(i.platformFee + i.platformFeeVat) FROM Invoice i 
        WHERE i.status IN ('SENT', 'ANAF_SUBMITTED', 'COMPLETED') 
        AND i.createdAt BETWEEN :startDate AND :endDate
    """)
    fun sumPlatformFees(startDate: OffsetDateTime, endDate: OffsetDateTime): Long?
    
    @Query("""
        SELECT SUM(i.coachAmount) FROM Invoice i 
        WHERE i.status IN ('SENT', 'ANAF_SUBMITTED', 'COMPLETED') 
        AND i.createdAt BETWEEN :startDate AND :endDate
    """)
    fun sumCoachPayouts(startDate: OffsetDateTime, endDate: OffsetDateTime): Long?
}
