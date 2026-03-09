package com.club.triathlon.enums

/**
 * Determines who issues the invoice:
 * - COACH: Coach has PFA/SRL, invoice is issued on coach's company
 * - PLATFORM: Coach has no company, platform issues the invoice
 */
enum class IssuerType {
    COACH,
    PLATFORM
}
