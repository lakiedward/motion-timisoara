package com.club.triathlon.domain

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.FetchType
import jakarta.persistence.JoinColumn
import jakarta.persistence.JoinTable
import jakarta.persistence.ManyToMany
import jakarta.persistence.OneToOne
import jakarta.persistence.Table
import java.time.OffsetDateTime

@Entity
@Table(name = "clubs")
open class Club : BaseEntity() {

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "owner_user_id", nullable = false, unique = true)
    lateinit var owner: User

    @Column(name = "name", nullable = false)
    lateinit var name: String

    @Column(name = "description", columnDefinition = "TEXT")
    var description: String? = null

    @Column(name = "logo_url")
    var logoUrl: String? = null

    @Column(name = "logo")
    var logo: ByteArray? = null

    @Column(name = "logo_content_type", length = 50)
    var logoContentType: String? = null

    @Column(name = "hero_photo")
    var heroPhoto: ByteArray? = null

    @Column(name = "hero_photo_content_type", length = 100)
    var heroPhotoContentType: String? = null

    @Column(name = "logo_s3_key", length = 500)
    var logoS3Key: String? = null

    @Column(name = "hero_photo_s3_key", length = 500)
    var heroPhotoS3Key: String? = null

    @Column(name = "website")
    var website: String? = null

    @Column(name = "phone")
    var phone: String? = null

    @Column(name = "email")
    var email: String? = null

    @Column(name = "public_email_consent", nullable = false)
    var publicEmailConsent: Boolean = false

    @Column(name = "address", columnDefinition = "TEXT")
    var address: String? = null

    @Column(name = "city")
    var city: String? = null

    @Column(name = "created_at", nullable = false)
    lateinit var createdAt: OffsetDateTime

    // ============================================
    // Stripe Connect Fields (required for clubs)
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
    // Company Info for Invoicing (required for clubs)
    // ============================================
    
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
    // Sports offered by this club
    // ============================================

    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(
        name = "club_sports",
        joinColumns = [JoinColumn(name = "club_id")],
        inverseJoinColumns = [JoinColumn(name = "sport_id")]
    )
    var sports: MutableSet<Sport> = mutableSetOf()

    // ============================================
    // Coaches associated with this club
    // ============================================

    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(
        name = "club_coaches",
        joinColumns = [JoinColumn(name = "club_id")],
        inverseJoinColumns = [JoinColumn(name = "coach_profile_id")]
    )
    var coaches: MutableSet<CoachProfile> = mutableSetOf()

    // ============================================
    // Helper Methods
    // ============================================

    /**
     * Check if club can receive payments via Stripe Connect
     */
    fun canReceivePayments(): Boolean = 
        stripeAccountId != null && stripeOnboardingComplete && stripeChargesEnabled

    /**
     * Check if club can receive payouts
     */
    fun canReceivePayouts(): Boolean = 
        canReceivePayments() && stripePayoutsEnabled

    /**
     * Check if Stripe onboarding is required
     */
    fun requiresStripeOnboarding(): Boolean =
        stripeAccountId == null || !stripeOnboardingComplete

    /**
     * Check if club has complete business info
     */
    fun hasCompleteBusinessInfo(): Boolean =
        !companyName.isNullOrBlank() && !companyCui.isNullOrBlank()

    override fun toString(): String {
        return "Club(id=$id, name=$name, owner=${owner.email})"
    }
}
