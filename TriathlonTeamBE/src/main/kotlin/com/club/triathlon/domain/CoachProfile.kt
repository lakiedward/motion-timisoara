package com.club.triathlon.domain

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.FetchType
import jakarta.persistence.JoinColumn
import jakarta.persistence.JoinTable
import jakarta.persistence.ManyToMany
import jakarta.persistence.OneToOne
import jakarta.persistence.Table

@Entity
@Table(name = "coach_profiles")
open class CoachProfile : BaseEntity() {

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false, unique = true)
    lateinit var user: User

    @Column(name = "bio", columnDefinition = "text")
    var bio: String? = null

    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(
        name = "coach_sports",
        joinColumns = [JoinColumn(name = "coach_profile_id")],
        inverseJoinColumns = [JoinColumn(name = "sport_id")]
    )
    var sports: MutableSet<Sport> = mutableSetOf()

    @Column(name = "avatar_url")
    var avatarUrl: String? = null

    @jakarta.persistence.Lob
    @Column(name = "photo")
    var photo: ByteArray? = null

    @Column(name = "photo_content_type", length = 100)
    var photoContentType: String? = null

    @Column(name = "photo_s3_key", length = 500)
    var photoS3Key: String? = null

    // ============================================
    // Stripe Connect Fields
    // ============================================
    
    @Column(name = "stripe_account_id")
    var stripeAccountId: String? = null

    @Column(name = "stripe_onboarding_complete", nullable = false)
    var stripeOnboardingComplete: Boolean = false

    @Column(name = "stripe_charges_enabled", nullable = false)
    var stripeChargesEnabled: Boolean = false

    @Column(name = "stripe_payouts_enabled", nullable = false)
    var stripePayoutsEnabled: Boolean = false

    // ============================================
    // Company Info for Invoicing (PFA/SRL)
    // ============================================
    
    @Column(name = "has_company", nullable = false)
    var hasCompany: Boolean = false

    @Column(name = "company_name")
    var companyName: String? = null

    @Column(name = "company_cui", length = 20)
    var companyCui: String? = null

    @Column(name = "company_reg_number", length = 50)
    var companyRegNumber: String? = null

    @Column(name = "company_address", columnDefinition = "TEXT")
    var companyAddress: String? = null

    @Column(name = "bank_account", length = 50)
    var bankAccount: String? = null

    @Column(name = "bank_name", length = 100)
    var bankName: String? = null

    // ============================================
    // Clubs this coach belongs to
    // ============================================

    @ManyToMany(mappedBy = "coaches", fetch = FetchType.LAZY)
    var clubs: MutableSet<Club> = mutableSetOf()

    // ============================================
    // Helper Methods
    // ============================================

    /**
     * Check if coach can receive payments via Stripe Connect
     */
    fun canReceivePayments(): Boolean = 
        stripeAccountId != null && stripeOnboardingComplete && stripeChargesEnabled

    /**
     * Check if coach can receive payouts
     */
    fun canReceivePayouts(): Boolean = 
        canReceivePayments() && stripePayoutsEnabled

    /**
     * Check if invoices should be issued on coach's company
     */
    fun shouldIssueCoachInvoice(): Boolean = 
        hasCompany && !companyCui.isNullOrBlank()

    /**
     * Check if Stripe onboarding is required
     */
    fun requiresStripeOnboarding(): Boolean =
        stripeAccountId != null && !stripeOnboardingComplete
}