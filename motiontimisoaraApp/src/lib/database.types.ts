export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: '14.5'
  }
  public: {
    Tables: {
      activities: {
        Row: {
          active: boolean
          activity_date: string
          capacity: number | null
          club_id: string | null
          coach_id: string
          created_at: string
          currency: string
          description: string | null
          end_time: string
          hero_photo_storage_path: string | null
          id: string
          location_id: string
          name: string
          payment_recipient: string
          price: number
          sport_id: string
          start_time: string
          updated_at: string | null
        }
        Insert: {
          active?: boolean
          activity_date: string
          capacity?: number | null
          club_id?: string | null
          coach_id: string
          created_at?: string
          currency?: string
          description?: string | null
          end_time: string
          hero_photo_storage_path?: string | null
          id?: string
          location_id: string
          name: string
          payment_recipient?: string
          price?: number
          sport_id: string
          start_time: string
          updated_at?: string | null
        }
        Update: {
          active?: boolean
          activity_date?: string
          capacity?: number | null
          club_id?: string | null
          coach_id?: string
          created_at?: string
          currency?: string
          description?: string | null
          end_time?: string
          hero_photo_storage_path?: string | null
          id?: string
          location_id?: string
          name?: string
          payment_recipient?: string
          price?: number
          sport_id?: string
          start_time?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      announcement_attachments: {
        Row: {
          announcement_id: string
          content_type: string | null
          created_at: string
          display_order: number
          id: string
          storage_path: string | null
          type: string
          url: string | null
        }
        Insert: {
          announcement_id: string
          content_type?: string | null
          created_at?: string
          display_order?: number
          id?: string
          storage_path?: string | null
          type: string
          url?: string | null
        }
        Update: {
          announcement_id?: string
          content_type?: string | null
          created_at?: string
          display_order?: number
          id?: string
          storage_path?: string | null
          type?: string
          url?: string | null
        }
        Relationships: []
      }
      attendance: {
        Row: {
          child_id: string
          id: string
          note: string | null
          occurrence_id: string
          status: string
        }
        Insert: {
          child_id: string
          id?: string
          note?: string | null
          occurrence_id: string
          status: string
        }
        Update: {
          child_id?: string
          id?: string
          note?: string | null
          occurrence_id?: string
          status?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          actor_user_id: string | null
          field_name: string | null
          id: string
          ip_address: string | null
          metadata: Json | null
          new_value: string | null
          old_value: string | null
          target_entity_id: string
          target_entity_type: string
          timestamp: string
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          field_name?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          new_value?: string | null
          old_value?: string | null
          target_entity_id: string
          target_entity_type: string
          timestamp?: string
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          field_name?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          new_value?: string | null
          old_value?: string | null
          target_entity_id?: string
          target_entity_type?: string
          timestamp?: string
        }
        Relationships: []
      }
      camps: {
        Row: {
          allow_cash: boolean
          capacity: number | null
          currency: string
          description: string | null
          gallery_json: string | null
          id: string
          location_text: string | null
          period_end: string
          period_start: string
          price: number
          slug: string
          title: string
        }
        Insert: {
          allow_cash?: boolean
          capacity?: number | null
          currency?: string
          description?: string | null
          gallery_json?: string | null
          id?: string
          location_text?: string | null
          period_end: string
          period_start: string
          price?: number
          slug: string
          title: string
        }
        Update: {
          allow_cash?: boolean
          capacity?: number | null
          currency?: string
          description?: string | null
          gallery_json?: string | null
          id?: string
          location_text?: string | null
          period_end?: string
          period_start?: string
          price?: number
          slug?: string
          title?: string
        }
        Relationships: []
      }
      children: {
        Row: {
          allergies: string | null
          birth_date: string
          emergency_contact_name: string | null
          emergency_phone: string | null
          gdpr_consent_at: string | null
          id: string
          level: string | null
          name: string
          parent_id: string
          photo_storage_path: string | null
          secondary_contact_name: string | null
          secondary_phone: string | null
          tshirt_size: string | null
        }
        Insert: {
          allergies?: string | null
          birth_date: string
          emergency_contact_name?: string | null
          emergency_phone?: string | null
          gdpr_consent_at?: string | null
          id?: string
          level?: string | null
          name: string
          parent_id: string
          photo_storage_path?: string | null
          secondary_contact_name?: string | null
          secondary_phone?: string | null
          tshirt_size?: string | null
        }
        Update: {
          allergies?: string | null
          birth_date?: string
          emergency_contact_name?: string | null
          emergency_phone?: string | null
          gdpr_consent_at?: string | null
          id?: string
          level?: string | null
          name?: string
          parent_id?: string
          photo_storage_path?: string | null
          secondary_contact_name?: string | null
          secondary_phone?: string | null
          tshirt_size?: string | null
        }
        Relationships: []
      }
      club_announcements: {
        Row: {
          audience_id: string | null
          audience_kind: string
          author_user_id: string
          club_id: string
          content: string
          created_at: string
          expires_at: string | null
          id: string
          is_active: boolean
          priority: string
          publish_at: string | null
          title: string
          updated_at: string
        }
        Insert: {
          audience_id?: string | null
          audience_kind?: string
          author_user_id: string
          club_id: string
          content: string
          created_at?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          priority?: string
          publish_at?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          audience_id?: string | null
          audience_kind?: string
          author_user_id?: string
          club_id?: string
          content?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          priority?: string
          publish_at?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      club_coaches: {
        Row: { club_id: string; coach_profile_id: string }
        Insert: { club_id: string; coach_profile_id: string }
        Update: { club_id?: string; coach_profile_id?: string }
        Relationships: []
      }
      club_invitation_codes: {
        Row: {
          club_id: string
          code: string
          created_at: string
          created_by_user_id: string
          current_uses: number
          expires_at: string | null
          id: string
          max_uses: number
          notes: string | null
        }
        Insert: {
          club_id: string
          code: string
          created_at?: string
          created_by_user_id: string
          current_uses?: number
          expires_at?: string | null
          id?: string
          max_uses?: number
          notes?: string | null
        }
        Update: {
          club_id?: string
          code?: string
          created_at?: string
          created_by_user_id?: string
          current_uses?: number
          expires_at?: string | null
          id?: string
          max_uses?: number
          notes?: string | null
        }
        Relationships: []
      }
      club_sports: {
        Row: { club_id: string; sport_id: string }
        Insert: { club_id: string; sport_id: string }
        Update: { club_id?: string; sport_id?: string }
        Relationships: []
      }
      clubs: {
        Row: {
          address: string | null
          bank_account: string | null
          bank_name: string | null
          city: string | null
          company_address: string | null
          company_cui: string | null
          company_name: string | null
          company_reg_number: string | null
          created_at: string
          description: string | null
          email: string | null
          hero_photo_storage_path: string | null
          id: string
          logo_storage_path: string | null
          name: string
          owner_user_id: string
          phone: string | null
          public_email_consent: boolean
          stripe_account_id: string | null
          stripe_charges_enabled: boolean
          stripe_onboarding_complete: boolean
          stripe_payouts_enabled: boolean
          website: string | null
        }
        Insert: {
          address?: string | null
          bank_account?: string | null
          bank_name?: string | null
          city?: string | null
          company_address?: string | null
          company_cui?: string | null
          company_name?: string | null
          company_reg_number?: string | null
          created_at?: string
          description?: string | null
          email?: string | null
          hero_photo_storage_path?: string | null
          id?: string
          logo_storage_path?: string | null
          name: string
          owner_user_id: string
          phone?: string | null
          public_email_consent?: boolean
          stripe_account_id?: string | null
          stripe_charges_enabled?: boolean
          stripe_onboarding_complete?: boolean
          stripe_payouts_enabled?: boolean
          website?: string | null
        }
        Update: {
          address?: string | null
          bank_account?: string | null
          bank_name?: string | null
          city?: string | null
          company_address?: string | null
          company_cui?: string | null
          company_name?: string | null
          company_reg_number?: string | null
          created_at?: string
          description?: string | null
          email?: string | null
          hero_photo_storage_path?: string | null
          id?: string
          logo_storage_path?: string | null
          name?: string
          owner_user_id?: string
          phone?: string | null
          public_email_consent?: boolean
          stripe_account_id?: string | null
          stripe_charges_enabled?: boolean
          stripe_onboarding_complete?: boolean
          stripe_payouts_enabled?: boolean
          website?: string | null
        }
        Relationships: []
      }
      coach_invitation_codes: {
        Row: {
          code: string
          created_at: string
          created_by_admin_id: string
          current_uses: number
          expires_at: string | null
          id: string
          max_uses: number
          notes: string | null
          used_at: string | null
          used_by_user_id: string | null
        }
        Insert: {
          code: string
          created_at?: string
          created_by_admin_id: string
          current_uses?: number
          expires_at?: string | null
          id?: string
          max_uses?: number
          notes?: string | null
          used_at?: string | null
          used_by_user_id?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          created_by_admin_id?: string
          current_uses?: number
          expires_at?: string | null
          id?: string
          max_uses?: number
          notes?: string | null
          used_at?: string | null
          used_by_user_id?: string | null
        }
        Relationships: []
      }
      coach_profiles: {
        Row: {
          avatar_url: string | null
          bank_account: string | null
          bank_name: string | null
          bio: string | null
          company_address: string | null
          company_cui: string | null
          company_name: string | null
          company_reg_number: string | null
          has_company: boolean
          id: string
          photo_storage_path: string | null
          stripe_account_id: string | null
          stripe_charges_enabled: boolean
          stripe_onboarding_complete: boolean
          stripe_payouts_enabled: boolean
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          bank_account?: string | null
          bank_name?: string | null
          bio?: string | null
          company_address?: string | null
          company_cui?: string | null
          company_name?: string | null
          company_reg_number?: string | null
          has_company?: boolean
          id?: string
          photo_storage_path?: string | null
          stripe_account_id?: string | null
          stripe_charges_enabled?: boolean
          stripe_onboarding_complete?: boolean
          stripe_payouts_enabled?: boolean
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          bank_account?: string | null
          bank_name?: string | null
          bio?: string | null
          company_address?: string | null
          company_cui?: string | null
          company_name?: string | null
          company_reg_number?: string | null
          has_company?: boolean
          id?: string
          photo_storage_path?: string | null
          stripe_account_id?: string | null
          stripe_charges_enabled?: boolean
          stripe_onboarding_complete?: boolean
          stripe_payouts_enabled?: boolean
          user_id?: string
        }
        Relationships: []
      }
      coach_ratings: {
        Row: {
          coach_id: string
          comment: string | null
          created_at: string
          id: string
          parent_id: string
          rating: number
          updated_at: string
        }
        Insert: {
          coach_id: string
          comment?: string | null
          created_at?: string
          id?: string
          parent_id: string
          rating: number
          updated_at?: string
        }
        Update: {
          coach_id?: string
          comment?: string | null
          created_at?: string
          id?: string
          parent_id?: string
          rating?: number
          updated_at?: string
        }
        Relationships: []
      }
      coach_sports: {
        Row: { coach_profile_id: string; sport_id: string }
        Insert: { coach_profile_id: string; sport_id: string }
        Update: { coach_profile_id?: string; sport_id?: string }
        Relationships: []
      }
      course_announcements: {
        Row: {
          author_user_id: string
          content: string
          course_id: string
          created_at: string
          id: string
          pinned: boolean
        }
        Insert: {
          author_user_id: string
          content: string
          course_id: string
          created_at?: string
          id?: string
          pinned?: boolean
        }
        Update: {
          author_user_id?: string
          content?: string
          course_id?: string
          created_at?: string
          id?: string
          pinned?: boolean
        }
        Relationships: []
      }
      course_occurrences: {
        Row: { course_id: string; ends_at: string; id: string; starts_at: string }
        Insert: { course_id: string; ends_at: string; id?: string; starts_at: string }
        Update: { course_id?: string; ends_at?: string; id?: string; starts_at?: string }
        Relationships: []
      }
      course_photos: {
        Row: {
          content_type: string
          course_id: string
          created_at: string
          display_order: number
          id: string
          storage_path: string
          updated_at: string
        }
        Insert: {
          content_type: string
          course_id: string
          created_at?: string
          display_order?: number
          id?: string
          storage_path: string
          updated_at?: string
        }
        Update: {
          content_type?: string
          course_id?: string
          created_at?: string
          display_order?: number
          id?: string
          storage_path?: string
          updated_at?: string
        }
        Relationships: []
      }
      course_ratings: {
        Row: {
          comment: string | null
          course_id: string
          created_at: string
          id: string
          parent_id: string
          rating: number
          updated_at: string
        }
        Insert: {
          comment?: string | null
          course_id: string
          created_at?: string
          id?: string
          parent_id: string
          rating: number
          updated_at?: string
        }
        Update: {
          comment?: string | null
          course_id?: string
          created_at?: string
          id?: string
          parent_id?: string
          rating?: number
          updated_at?: string
        }
        Relationships: []
      }
      courses: {
        Row: {
          active: boolean
          age_from: number | null
          age_to: number | null
          capacity: number | null
          club_id: string | null
          coach_id: string
          currency: string
          description: string | null
          hero_photo_storage_path: string | null
          id: string
          level: string | null
          location_id: string
          name: string
          package_options: string | null
          payment_recipient: string
          price: number
          price_per_session: number
          recurrence_rule: string | null
          sport_id: string
        }
        Insert: {
          active?: boolean
          age_from?: number | null
          age_to?: number | null
          capacity?: number | null
          club_id?: string | null
          coach_id: string
          currency?: string
          description?: string | null
          hero_photo_storage_path?: string | null
          id?: string
          level?: string | null
          location_id: string
          name: string
          package_options?: string | null
          payment_recipient?: string
          price?: number
          price_per_session?: number
          recurrence_rule?: string | null
          sport_id: string
        }
        Update: {
          active?: boolean
          age_from?: number | null
          age_to?: number | null
          capacity?: number | null
          club_id?: string | null
          coach_id?: string
          currency?: string
          description?: string | null
          hero_photo_storage_path?: string | null
          id?: string
          level?: string | null
          location_id?: string
          name?: string
          package_options?: string | null
          payment_recipient?: string
          price?: number
          price_per_session?: number
          recurrence_rule?: string | null
          sport_id?: string
        }
        Relationships: []
      }
      enrollments: {
        Row: {
          child_id: string
          created_at: string
          entity_id: string
          first_session_date: string | null
          id: string
          kind: string
          purchased_sessions: number
          remaining_sessions: number
          sessions_used: number
          status: string
        }
        Insert: {
          child_id: string
          created_at?: string
          entity_id: string
          first_session_date?: string | null
          id?: string
          kind: string
          purchased_sessions?: number
          remaining_sessions?: number
          sessions_used?: number
          status: string
        }
        Update: {
          child_id?: string
          created_at?: string
          entity_id?: string
          first_session_date?: string | null
          id?: string
          kind?: string
          purchased_sessions?: number
          remaining_sessions?: number
          sessions_used?: number
          status?: string
        }
        Relationships: []
      }
      invoices: {
        Row: {
          anaf_index: string | null
          anaf_submitted_at: string | null
          coach_amount: number
          created_at: string
          error_message: string | null
          id: string
          invoice_type: string
          issuer_type: string
          payment_id: string
          platform_fee: number
          platform_fee_vat: number
          sent_at: string | null
          smartbill_id: string | null
          smartbill_number: string | null
          smartbill_series: string | null
          status: string
          subtotal: number
          total_amount: number
          vat_amount: number
        }
        Insert: {
          anaf_index?: string | null
          anaf_submitted_at?: string | null
          coach_amount?: number
          created_at?: string
          error_message?: string | null
          id?: string
          invoice_type: string
          issuer_type: string
          payment_id: string
          platform_fee?: number
          platform_fee_vat?: number
          sent_at?: string | null
          smartbill_id?: string | null
          smartbill_number?: string | null
          smartbill_series?: string | null
          status?: string
          subtotal?: number
          total_amount?: number
          vat_amount?: number
        }
        Update: {
          anaf_index?: string | null
          anaf_submitted_at?: string | null
          coach_amount?: number
          created_at?: string
          error_message?: string | null
          id?: string
          invoice_type?: string
          issuer_type?: string
          payment_id?: string
          platform_fee?: number
          platform_fee_vat?: number
          sent_at?: string | null
          smartbill_id?: string | null
          smartbill_number?: string | null
          smartbill_series?: string | null
          status?: string
          subtotal?: number
          total_amount?: number
          vat_amount?: number
        }
        Relationships: []
      }
      locations: {
        Row: {
          address: string | null
          capacity: number | null
          city: string | null
          club_id: string | null
          created_by_user_id: string | null
          description: string | null
          fts: unknown
          id: string
          is_active: boolean
          lat: number | null
          lng: number | null
          name: string
          type: string
        }
        Insert: {
          address?: string | null
          capacity?: number | null
          city?: string | null
          club_id?: string | null
          created_by_user_id?: string | null
          description?: string | null
          fts?: unknown
          id?: string
          is_active?: boolean
          lat?: number | null
          lng?: number | null
          name: string
          type: string
        }
        Update: {
          address?: string | null
          capacity?: number | null
          city?: string | null
          club_id?: string | null
          created_by_user_id?: string | null
          description?: string | null
          fts?: unknown
          id?: string
          is_active?: boolean
          lat?: number | null
          lng?: number | null
          name?: string
          type?: string
        }
        Relationships: []
      }
      monthly_payments: {
        Row: {
          amount: number
          created_at: string
          currency: string
          enrollment_id: string
          id: string
          method: string
          month_year: string
          paid_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount?: number
          created_at?: string
          currency?: string
          enrollment_id: string
          id?: string
          method: string
          month_year: string
          paid_at?: string | null
          status: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          enrollment_id?: string
          id?: string
          method?: string
          month_year?: string
          paid_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          billing_address_line1: string | null
          billing_city: string | null
          billing_country: string | null
          billing_email: string | null
          billing_name: string | null
          billing_postal_code: string | null
          client_secret: string | null
          coach_payout_amount: number | null
          created_at: string
          currency: string
          enrollment_id: string
          gateway_txn_id: string | null
          id: string
          invoice_id: string | null
          invoice_url: string | null
          method: string
          paid_at: string | null
          platform_fee_amount: number | null
          status: string
          stripe_transfer_id: string | null
          updated_at: string
        }
        Insert: {
          amount?: number
          billing_address_line1?: string | null
          billing_city?: string | null
          billing_country?: string | null
          billing_email?: string | null
          billing_name?: string | null
          billing_postal_code?: string | null
          client_secret?: string | null
          coach_payout_amount?: number | null
          created_at?: string
          currency?: string
          enrollment_id: string
          gateway_txn_id?: string | null
          id?: string
          invoice_id?: string | null
          invoice_url?: string | null
          method: string
          paid_at?: string | null
          platform_fee_amount?: number | null
          status: string
          stripe_transfer_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          billing_address_line1?: string | null
          billing_city?: string | null
          billing_country?: string | null
          billing_email?: string | null
          billing_name?: string | null
          billing_postal_code?: string | null
          client_secret?: string | null
          coach_payout_amount?: number | null
          created_at?: string
          currency?: string
          enrollment_id?: string
          gateway_txn_id?: string | null
          id?: string
          invoice_id?: string | null
          invoice_url?: string | null
          method?: string
          paid_at?: string | null
          platform_fee_amount?: number | null
          status?: string
          stripe_transfer_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          enabled: boolean
          id: string
          name: string
          oauth_provider: string | null
          oauth_provider_id: string | null
          phone: string | null
          role: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          enabled?: boolean
          id: string
          name: string
          oauth_provider?: string | null
          oauth_provider_id?: string | null
          phone?: string | null
          role: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          enabled?: boolean
          id?: string
          name?: string
          oauth_provider?: string | null
          oauth_provider_id?: string | null
          phone?: string | null
          role?: string
        }
        Relationships: []
      }
      sports: {
        Row: {
          code: string
          default_photo_storage_path: string | null
          id: string
          name: string
        }
        Insert: {
          code: string
          default_photo_storage_path?: string | null
          id?: string
          name: string
        }
        Update: {
          code?: string
          default_photo_storage_path?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      user_recent_locations: {
        Row: {
          id: string
          last_used_at: string
          location_id: string
          use_count: number
          user_id: string
        }
        Insert: {
          id?: string
          last_used_at?: string
          location_id: string
          use_count?: number
          user_id: string
        }
        Update: {
          id?: string
          last_used_at?: string
          location_id?: string
          use_count?: number
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      course_spots_remaining: { Args: { p_course_id: string }; Returns: number }
      custom_access_token_hook: { Args: { event: Json }; Returns: Json }
      get_my_club_id: { Args: Record<PropertyKey, never>; Returns: string }
      get_my_coach_profile_id: { Args: Record<PropertyKey, never>; Returns: string }
      get_my_role: { Args: Record<PropertyKey, never>; Returns: string }
      is_my_child: { Args: { child_uuid: string }; Returns: boolean }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database['public']

export type Tables<T extends keyof DefaultSchema['Tables']> =
  DefaultSchema['Tables'][T]['Row']
export type TablesInsert<T extends keyof DefaultSchema['Tables']> =
  DefaultSchema['Tables'][T]['Insert']
export type TablesUpdate<T extends keyof DefaultSchema['Tables']> =
  DefaultSchema['Tables'][T]['Update']
