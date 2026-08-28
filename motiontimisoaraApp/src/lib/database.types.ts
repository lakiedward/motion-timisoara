export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.17"
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
        Relationships: [
          {
            foreignKeyName: "activities_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_sport_id_fkey"
            columns: ["sport_id"]
            isOneToOne: false
            referencedRelation: "sports"
            referencedColumns: ["id"]
          },
        ]
      }
      announcement_attachments: {
        Row: {
          announcement_id: string | null
          club_announcement_id: string | null
          content_type: string | null
          created_at: string
          display_order: number
          expires_at: string | null
          id: string
          storage_path: string | null
          type: string
          url: string | null
        }
        Insert: {
          announcement_id?: string | null
          club_announcement_id?: string | null
          content_type?: string | null
          created_at?: string
          display_order?: number
          expires_at?: string | null
          id?: string
          storage_path?: string | null
          type: string
          url?: string | null
        }
        Update: {
          announcement_id?: string | null
          club_announcement_id?: string | null
          content_type?: string | null
          created_at?: string
          display_order?: number
          expires_at?: string | null
          id?: string
          storage_path?: string | null
          type?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "announcement_attachments_announcement_id_fkey"
            columns: ["announcement_id"]
            isOneToOne: false
            referencedRelation: "course_announcements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcement_attachments_club_announcement_id_fkey"
            columns: ["club_announcement_id"]
            isOneToOne: false
            referencedRelation: "club_announcements"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "attendance_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_occurrence_id_fkey"
            columns: ["occurrence_id"]
            isOneToOne: false
            referencedRelation: "course_occurrences"
            referencedColumns: ["id"]
          },
        ]
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
      camp_coaches: {
        Row: {
          camp_id: string
          coach_profile_id: string
          created_at: string
          invited_at: string
          responded_at: string | null
          status: string
        }
        Insert: {
          camp_id: string
          coach_profile_id: string
          created_at?: string
          invited_at?: string
          responded_at?: string | null
          status?: string
        }
        Update: {
          camp_id?: string
          coach_profile_id?: string
          created_at?: string
          invited_at?: string
          responded_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "camp_coaches_camp_id_fkey"
            columns: ["camp_id"]
            isOneToOne: false
            referencedRelation: "camps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "camp_coaches_coach_profile_id_fkey"
            columns: ["coach_profile_id"]
            isOneToOne: false
            referencedRelation: "coach_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      camp_photos: {
        Row: {
          camp_id: string
          created_at: string
          display_order: number
          id: string
          storage_path: string
        }
        Insert: {
          camp_id: string
          created_at?: string
          display_order?: number
          id?: string
          storage_path: string
        }
        Update: {
          camp_id?: string
          created_at?: string
          display_order?: number
          id?: string
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "camp_photos_camp_id_fkey"
            columns: ["camp_id"]
            isOneToOne: false
            referencedRelation: "camps"
            referencedColumns: ["id"]
          },
        ]
      }
      camp_price_items: {
        Row: {
          amount: number
          camp_id: string
          created_at: string
          description: string | null
          display_order: number
          id: string
          name: string
        }
        Insert: {
          amount: number
          camp_id: string
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          name: string
        }
        Update: {
          amount?: number
          camp_id?: string
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "camp_price_items_camp_id_fkey"
            columns: ["camp_id"]
            isOneToOne: false
            referencedRelation: "camps"
            referencedColumns: ["id"]
          },
        ]
      }
      camps: {
        Row: {
          allow_cash: boolean
          capacity: number | null
          club_id: string | null
          coach_id: string | null
          currency: string
          description: string | null
          gallery_json: string | null
          hero_photo_storage_path: string | null
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
          club_id?: string | null
          coach_id?: string | null
          currency?: string
          description?: string | null
          gallery_json?: string | null
          hero_photo_storage_path?: string | null
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
          club_id?: string | null
          coach_id?: string | null
          currency?: string
          description?: string | null
          gallery_json?: string | null
          hero_photo_storage_path?: string | null
          id?: string
          location_text?: string | null
          period_end?: string
          period_start?: string
          price?: number
          slug?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "camps_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "camps_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "children_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "club_announcements_author_user_id_fkey"
            columns: ["author_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_announcements_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      club_coaches: {
        Row: {
          club_id: string
          coach_profile_id: string
        }
        Insert: {
          club_id: string
          coach_profile_id: string
        }
        Update: {
          club_id?: string
          coach_profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_coaches_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_coaches_coach_profile_id_fkey"
            columns: ["coach_profile_id"]
            isOneToOne: false
            referencedRelation: "coach_profiles"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "club_invitation_codes_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_invitation_codes_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      club_sports: {
        Row: {
          club_id: string
          sport_id: string
        }
        Insert: {
          club_id: string
          sport_id: string
        }
        Update: {
          club_id?: string
          sport_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_sports_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_sports_sport_id_fkey"
            columns: ["sport_id"]
            isOneToOne: false
            referencedRelation: "sports"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "clubs_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "coach_invitation_codes_created_by_admin_id_fkey"
            columns: ["created_by_admin_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_invitation_codes_used_by_user_id_fkey"
            columns: ["used_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "coach_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "coach_ratings_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_ratings_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      coach_sports: {
        Row: {
          coach_profile_id: string
          sport_id: string
        }
        Insert: {
          coach_profile_id: string
          sport_id: string
        }
        Update: {
          coach_profile_id?: string
          sport_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "coach_sports_coach_profile_id_fkey"
            columns: ["coach_profile_id"]
            isOneToOne: false
            referencedRelation: "coach_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_sports_sport_id_fkey"
            columns: ["sport_id"]
            isOneToOne: false
            referencedRelation: "sports"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "course_announcements_author_user_id_fkey"
            columns: ["author_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_announcements_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      course_occurrences: {
        Row: {
          course_id: string
          ends_at: string
          id: string
          starts_at: string
        }
        Insert: {
          course_id: string
          ends_at: string
          id?: string
          starts_at: string
        }
        Update: {
          course_id?: string
          ends_at?: string
          id?: string
          starts_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_occurrences_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "course_photos_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "course_ratings_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_ratings_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "courses_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courses_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courses_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courses_sport_id_fkey"
            columns: ["sport_id"]
            isOneToOne: false
            referencedRelation: "sports"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "enrollments_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "invoices_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "locations_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "locations_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "monthly_payments_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "payments_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
        ]
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
      user_announcement_views: {
        Row: {
          last_seen_at: string
          user_id: string
        }
        Insert: {
          last_seen_at?: string
          user_id: string
        }
        Update: {
          last_seen_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_announcement_views_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "user_recent_locations_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_recent_locations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      audience_club_id: {
        Args: { p_id: string; p_kind: string }
        Returns: string
      }
      camp_enrolled_child_ids: { Args: never; Returns: string[] }
      camp_spots_remaining: { Args: { p_camp_id: string }; Returns: number }
      cheama_purge_expired_media: { Args: never; Returns: undefined }
      club_enrolled_child_ids: { Args: never; Returns: string[] }
      coach_enrolled_child_ids: { Args: never; Returns: string[] }
      course_availability: {
        Args: never
        Returns: {
          course_id: string
          is_full: boolean
        }[]
      }
      course_spots_remaining: { Args: { p_course_id: string }; Returns: number }
      custom_access_token_hook: { Args: { event: Json }; Returns: Json }
      get_my_coach_profile_id: { Args: never; Returns: string }
      get_my_role: { Args: never; Returns: string }
      my_child_ids: { Args: never; Returns: string[] }
      my_club_coach_user_ids: { Args: never; Returns: string[] }
      my_club_ids: { Args: never; Returns: string[] }
      pot_administra_tabara: { Args: { p_camp_id: string }; Returns: boolean }
      pot_vedea_inscrierile_taberei: {
        Args: { p_camp_id: string }
        Returns: boolean
      }
      raspunde_invitatie_tabara: {
        Args: { p_accept: boolean; p_camp_id: string }
        Returns: {
          camp_id: string
          coach_profile_id: string
          created_at: string
          invited_at: string
          responded_at: string | null
          status: string
        }
        SetofOptions: {
          from: "*"
          to: "camp_coaches"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      safe_uuid: { Args: { t: string }; Returns: string }
      salveaza_banii_taberei: {
        Args: { p_camp_id: string; p_categorii: Json; p_price: number }
        Returns: {
          amount: number
          camp_id: string
          created_at: string
          description: string | null
          display_order: number
          id: string
          name: string
        }[]
        SetofOptions: {
          from: "*"
          to: "camp_price_items"
          isOneToOne: false
          isSetofReturn: true
        }
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
