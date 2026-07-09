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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      activity_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          meta: Json | null
          summary: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          meta?: Json | null
          summary: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          meta?: Json | null
          summary?: string
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      cities: {
        Row: {
          country_code: string
          id: string
          name: string
        }
        Insert: {
          country_code: string
          id?: string
          name: string
        }
        Update: {
          country_code?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "cities_country_code_fkey"
            columns: ["country_code"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["code"]
          },
        ]
      }
      countries: {
        Row: {
          code: string
          name: string
          sort_order: number
        }
        Insert: {
          code: string
          name: string
          sort_order?: number
        }
        Update: {
          code?: string
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      fb_outreach: {
        Row: {
          business_name: string
          city_id: string | null
          contact_name: string | null
          country_code: string | null
          created_at: string
          created_by: string
          fb_page_url: string | null
          id: string
          message_status: Database["public"]["Enums"]["fb_message_status"]
          messaged_at: string | null
          niche_slug: string | null
          notes: string | null
          response: string | null
          updated_at: string
        }
        Insert: {
          business_name: string
          city_id?: string | null
          contact_name?: string | null
          country_code?: string | null
          created_at?: string
          created_by: string
          fb_page_url?: string | null
          id?: string
          message_status?: Database["public"]["Enums"]["fb_message_status"]
          messaged_at?: string | null
          niche_slug?: string | null
          notes?: string | null
          response?: string | null
          updated_at?: string
        }
        Update: {
          business_name?: string
          city_id?: string | null
          contact_name?: string | null
          country_code?: string | null
          created_at?: string
          created_by?: string
          fb_page_url?: string | null
          id?: string
          message_status?: Database["public"]["Enums"]["fb_message_status"]
          messaged_at?: string | null
          niche_slug?: string | null
          notes?: string | null
          response?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fb_outreach_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fb_outreach_country_code_fkey"
            columns: ["country_code"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "fb_outreach_niche_slug_fkey"
            columns: ["niche_slug"]
            isOneToOne: false
            referencedRelation: "niches"
            referencedColumns: ["slug"]
          },
        ]
      }
      fcm_tokens: {
        Row: {
          created_at: string
          device_label: string | null
          id: string
          last_seen_at: string
          token: string
          user_id: string
        }
        Insert: {
          created_at?: string
          device_label?: string | null
          id?: string
          last_seen_at?: string
          token: string
          user_id: string
        }
        Update: {
          created_at?: string
          device_label?: string | null
          id?: string
          last_seen_at?: string
          token?: string
          user_id?: string
        }
        Relationships: []
      }
      finance_entries: {
        Row: {
          amount_bdt: number
          amount_usd: number
          category: string
          client_name: string | null
          created_at: string
          created_by: string
          description: string | null
          entry_date: string
          id: string
          kind: Database["public"]["Enums"]["finance_kind"]
          notes: string | null
          paid_to: string | null
          project_name: string | null
          split_member_a: number | null
          split_member_b: number | null
          updated_at: string
          usd_rate: number | null
        }
        Insert: {
          amount_bdt?: number
          amount_usd?: number
          category: string
          client_name?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          entry_date?: string
          id?: string
          kind: Database["public"]["Enums"]["finance_kind"]
          notes?: string | null
          paid_to?: string | null
          project_name?: string | null
          split_member_a?: number | null
          split_member_b?: number | null
          updated_at?: string
          usd_rate?: number | null
        }
        Update: {
          amount_bdt?: number
          amount_usd?: number
          category?: string
          client_name?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          entry_date?: string
          id?: string
          kind?: Database["public"]["Enums"]["finance_kind"]
          notes?: string | null
          paid_to?: string | null
          project_name?: string | null
          split_member_a?: number | null
          split_member_b?: number | null
          updated_at?: string
          usd_rate?: number | null
        }
        Relationships: []
      }
      leads: {
        Row: {
          assigned_to: string | null
          business_name: string
          city_id: string | null
          competitor_strength: string | null
          country_code: string | null
          created_at: string
          created_by: string
          email: string | null
          first_contact_date: string | null
          followup_1_date: string | null
          followup_2_date: string | null
          followup_3_date: string | null
          found_date: string | null
          gbp_status: string | null
          gbp_url: string | null
          id: string
          last_contact_date: string | null
          lead_source: string | null
          local_ranking_potential: string | null
          monthly_lead_potential: number | null
          monthly_revenue: number | null
          next_action_date: string | null
          niche_slug: string | null
          notes: string | null
          order_status: string | null
          owner_name: string | null
          phone: string | null
          recommended_seo_service: string | null
          response_status: string | null
          seo_weakness_notes: string | null
          service_area: string | null
          status: Database["public"]["Enums"]["lead_status"]
          tag: string | null
          total_order_value: number | null
          updated_at: string
          website_score: number | null
          website_seo_status: string | null
          website_url: string | null
          whatsapp: string | null
        }
        Insert: {
          assigned_to?: string | null
          business_name: string
          city_id?: string | null
          competitor_strength?: string | null
          country_code?: string | null
          created_at?: string
          created_by: string
          email?: string | null
          first_contact_date?: string | null
          followup_1_date?: string | null
          followup_2_date?: string | null
          followup_3_date?: string | null
          found_date?: string | null
          gbp_status?: string | null
          gbp_url?: string | null
          id?: string
          last_contact_date?: string | null
          lead_source?: string | null
          local_ranking_potential?: string | null
          monthly_lead_potential?: number | null
          monthly_revenue?: number | null
          next_action_date?: string | null
          niche_slug?: string | null
          notes?: string | null
          order_status?: string | null
          owner_name?: string | null
          phone?: string | null
          recommended_seo_service?: string | null
          response_status?: string | null
          seo_weakness_notes?: string | null
          service_area?: string | null
          status?: Database["public"]["Enums"]["lead_status"]
          tag?: string | null
          total_order_value?: number | null
          updated_at?: string
          website_score?: number | null
          website_seo_status?: string | null
          website_url?: string | null
          whatsapp?: string | null
        }
        Update: {
          assigned_to?: string | null
          business_name?: string
          city_id?: string | null
          competitor_strength?: string | null
          country_code?: string | null
          created_at?: string
          created_by?: string
          email?: string | null
          first_contact_date?: string | null
          followup_1_date?: string | null
          followup_2_date?: string | null
          followup_3_date?: string | null
          found_date?: string | null
          gbp_status?: string | null
          gbp_url?: string | null
          id?: string
          last_contact_date?: string | null
          lead_source?: string | null
          local_ranking_potential?: string | null
          monthly_lead_potential?: number | null
          monthly_revenue?: number | null
          next_action_date?: string | null
          niche_slug?: string | null
          notes?: string | null
          order_status?: string | null
          owner_name?: string | null
          phone?: string | null
          recommended_seo_service?: string | null
          response_status?: string | null
          seo_weakness_notes?: string | null
          service_area?: string | null
          status?: Database["public"]["Enums"]["lead_status"]
          tag?: string | null
          total_order_value?: number | null
          updated_at?: string
          website_score?: number | null
          website_seo_status?: string | null
          website_url?: string | null
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_country_code_fkey"
            columns: ["country_code"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "leads_niche_slug_fkey"
            columns: ["niche_slug"]
            isOneToOne: false
            referencedRelation: "niches"
            referencedColumns: ["slug"]
          },
        ]
      }
      niches: {
        Row: {
          name: string
          slug: string
          sort_order: number
        }
        Insert: {
          name: string
          slug: string
          sort_order?: number
        }
        Update: {
          name?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          joined_at: string | null
          phone: string | null
          role_title: string | null
          timezone: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          joined_at?: string | null
          phone?: string | null
          role_title?: string | null
          timezone?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          joined_at?: string | null
          phone?: string | null
          role_title?: string | null
          timezone?: string | null
        }
        Relationships: []
      }
      saved_offers: {
        Row: {
          business_name: string | null
          content: string
          created_at: string
          id: string
          lead_id: string | null
          meta: Json | null
          template_key: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          business_name?: string | null
          content: string
          created_at?: string
          id?: string
          lead_id?: string | null
          meta?: Json | null
          template_key: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          business_name?: string | null
          content?: string
          created_at?: string
          id?: string
          lead_id?: string | null
          meta?: Json | null
          template_key?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_offers_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      search_history: {
        Row: {
          city_id: string | null
          created_at: string
          id: string
          niche_slug: string | null
          query: string
          user_id: string
        }
        Insert: {
          city_id?: string | null
          created_at?: string
          id?: string
          niche_slug?: string | null
          query: string
          user_id: string
        }
        Update: {
          city_id?: string | null
          created_at?: string
          id?: string
          niche_slug?: string | null
          query?: string
          user_id?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          assigned_to: string | null
          completed_at: string | null
          created_at: string
          created_by: string
          description: string | null
          duration_minutes: number | null
          id: string
          priority: Database["public"]["Enums"]["task_priority"]
          scheduled_date: string
          scheduled_time: string | null
          status: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          duration_minutes?: number | null
          id?: string
          priority?: Database["public"]["Enums"]["task_priority"]
          scheduled_date?: string
          scheduled_time?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          duration_minutes?: number | null
          id?: string
          priority?: Database["public"]["Enums"]["task_priority"]
          scheduled_date?: string
          scheduled_time?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "member"
      fb_message_status:
        | "to_contact"
        | "messaged"
        | "no_response"
        | "replied"
        | "not_interested"
        | "converted"
      finance_kind: "income" | "expense"
      lead_status:
        | "new"
        | "audit_done"
        | "email_sent"
        | "followup_1"
        | "followup_2"
        | "replied"
        | "meeting"
        | "proposal"
        | "closed_won"
        | "closed_lost"
        | "contacted"
        | "interested"
        | "proposal_sent"
        | "negotiation"
        | "converted"
        | "monthly_seo"
      task_priority: "low" | "medium" | "high"
      task_status: "pending" | "in_progress" | "done" | "skipped"
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
    Enums: {
      app_role: ["admin", "member"],
      fb_message_status: [
        "to_contact",
        "messaged",
        "no_response",
        "replied",
        "not_interested",
        "converted",
      ],
      finance_kind: ["income", "expense"],
      lead_status: [
        "new",
        "audit_done",
        "email_sent",
        "followup_1",
        "followup_2",
        "replied",
        "meeting",
        "proposal",
        "closed_won",
        "closed_lost",
        "contacted",
        "interested",
        "proposal_sent",
        "negotiation",
        "converted",
        "monthly_seo",
      ],
      task_priority: ["low", "medium", "high"],
      task_status: ["pending", "in_progress", "done", "skipped"],
    },
  },
} as const
