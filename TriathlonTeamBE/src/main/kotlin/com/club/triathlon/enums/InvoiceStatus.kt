package com.club.triathlon.enums

enum class InvoiceStatus {
    PENDING,          // Invoice record created, not yet sent to SmartBill
    SENT,             // Successfully sent to SmartBill
    ANAF_SUBMITTED,   // Submitted to ANAF e-Factura system
    COMPLETED,        // Fully processed and acknowledged by ANAF
    FAILED            // Error during processing
}
