-- V24: Coach Revenue Sharing System
-- Adds support for coach self-registration with invitation codes,
-- Stripe Connect integration, and SmartBill invoicing

-- ============================================
-- 1. Coach Invitation Codes Table
-- ============================================
CREATE TABLE coach_invitation_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) NOT NULL UNIQUE,
    created_by_admin_id UUID NOT NULL REFERENCES users(id),
    used_by_user_id UUID REFERENCES users(id),
    used_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    max_uses INTEGER NOT NULL DEFAULT 1,
    current_uses INTEGER NOT NULL DEFAULT 0,
    notes VARCHAR(500)
);

CREATE INDEX idx_coach_invitation_codes_code ON coach_invitation_codes(code);
CREATE INDEX idx_coach_invitation_codes_created_by ON coach_invitation_codes(created_by_admin_id);
CREATE INDEX idx_coach_invitation_codes_used_by ON coach_invitation_codes(used_by_user_id);

-- ============================================
-- 2. Extend Coach Profiles for Stripe Connect
-- ============================================
ALTER TABLE coach_profiles ADD COLUMN stripe_account_id VARCHAR(255);
ALTER TABLE coach_profiles ADD COLUMN stripe_onboarding_complete BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE coach_profiles ADD COLUMN stripe_charges_enabled BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE coach_profiles ADD COLUMN stripe_payouts_enabled BOOLEAN NOT NULL DEFAULT FALSE;

-- Company/Business info for invoicing (PFA/SRL)
ALTER TABLE coach_profiles ADD COLUMN has_company BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE coach_profiles ADD COLUMN company_name VARCHAR(255);
ALTER TABLE coach_profiles ADD COLUMN company_cui VARCHAR(20);
ALTER TABLE coach_profiles ADD COLUMN company_reg_number VARCHAR(50);
ALTER TABLE coach_profiles ADD COLUMN company_address TEXT;
ALTER TABLE coach_profiles ADD COLUMN bank_account VARCHAR(50);
ALTER TABLE coach_profiles ADD COLUMN bank_name VARCHAR(100);

CREATE INDEX idx_coach_profiles_stripe_account ON coach_profiles(stripe_account_id);

-- ============================================
-- 3. Invoices Table for SmartBill Integration
-- ============================================
CREATE TABLE invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id UUID NOT NULL REFERENCES payments(id),
    
    -- SmartBill reference
    smartbill_series VARCHAR(20),
    smartbill_number VARCHAR(50),
    smartbill_id VARCHAR(100),
    
    -- Invoice details
    invoice_type VARCHAR(20) NOT NULL,  -- COURSE, CAMP, ACTIVITY
    issuer_type VARCHAR(20) NOT NULL,   -- COACH, PLATFORM
    
    -- Amounts (in bani/cents)
    subtotal BIGINT NOT NULL,
    vat_amount BIGINT NOT NULL,
    total_amount BIGINT NOT NULL,
    platform_fee BIGINT NOT NULL,
    platform_fee_vat BIGINT NOT NULL,
    coach_amount BIGINT NOT NULL,
    
    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',  -- PENDING, SENT, ANAF_SUBMITTED, COMPLETED, FAILED
    anaf_index VARCHAR(100),
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    sent_at TIMESTAMP WITH TIME ZONE,
    anaf_submitted_at TIMESTAMP WITH TIME ZONE,
    
    -- Error tracking
    error_message TEXT
);

CREATE INDEX idx_invoices_payment ON invoices(payment_id);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoices_created_at ON invoices(created_at);

-- ============================================
-- 4. Add Stripe Connect fields to Payments
-- ============================================
ALTER TABLE payments ADD COLUMN stripe_transfer_id VARCHAR(255);
ALTER TABLE payments ADD COLUMN platform_fee_amount BIGINT;
ALTER TABLE payments ADD COLUMN coach_payout_amount BIGINT;

-- ============================================
-- 5. Comments for documentation
-- ============================================
COMMENT ON TABLE coach_invitation_codes IS 'Invitation codes for coach self-registration';
COMMENT ON COLUMN coach_invitation_codes.code IS 'Unique invitation code (e.g., COACH-ABC123)';
COMMENT ON COLUMN coach_invitation_codes.max_uses IS 'Maximum number of times this code can be used';
COMMENT ON COLUMN coach_invitation_codes.current_uses IS 'Current number of times this code has been used';

COMMENT ON COLUMN coach_profiles.stripe_account_id IS 'Stripe Connect Express account ID';
COMMENT ON COLUMN coach_profiles.stripe_onboarding_complete IS 'Whether coach has completed Stripe onboarding';
COMMENT ON COLUMN coach_profiles.has_company IS 'Whether coach has PFA/SRL for invoicing';
COMMENT ON COLUMN coach_profiles.company_cui IS 'Company CUI/CIF for invoicing';

COMMENT ON TABLE invoices IS 'SmartBill invoices generated for payments';
COMMENT ON COLUMN invoices.issuer_type IS 'COACH if coach has company, PLATFORM otherwise';
COMMENT ON COLUMN invoices.platform_fee IS 'Platform fee base amount (1%)';
COMMENT ON COLUMN invoices.platform_fee_vat IS 'VAT on platform fee (19% of 1%)';
COMMENT ON COLUMN invoices.anaf_index IS 'e-Factura ANAF index after submission';
