package com.club.triathlon.enums

/**
 * Determines who receives online payments for a course or activity
 */
enum class PaymentRecipientType {
    /** Payment goes to the coach's Stripe account */
    COACH,
    
    /** Payment goes to the club's Stripe account */
    CLUB
}
