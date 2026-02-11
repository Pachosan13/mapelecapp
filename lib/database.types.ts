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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      buildings: {
        Row: {
          address: string | null
          created_at: string | null
          created_by: string
          id: string
          lat: number | null
          lng: number | null
          name: string
          notes: string | null
          service_flags: string | null
          systems: string[]
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string | null
          created_by: string
          id?: string
          lat?: number | null
          lng?: number | null
          name: string
          notes?: string | null
          service_flags?: string | null
          systems?: string[]
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string | null
          created_by?: string
          id?: string
          lat?: number | null
          lng?: number | null
          name?: string
          notes?: string | null
          service_flags?: string | null
          systems?: string[]
          updated_at?: string | null
        }
        Relationships: []
      }
      crews: {
        Row: {
          category: Database["public"]["Enums"]["category"]
          created_at: string | null
          id: string
          name: string
        }
        Insert: {
          category: Database["public"]["Enums"]["category"]
          created_at?: string | null
          id?: string
          name: string
        }
        Update: {
          category?: Database["public"]["Enums"]["category"]
          created_at?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      equipment: {
        Row: {
          building_id: string
          created_at: string
          equipment_type: string
          id: string
          is_active: boolean
          location: string | null
          manufacturer: string | null
          model: string | null
          name: string
          notes: string | null
          serial: string | null
          tag: string | null
          updated_at: string
        }
        Insert: {
          building_id: string
          created_at?: string
          equipment_type: string
          id?: string
          is_active?: boolean
          location?: string | null
          manufacturer?: string | null
          model?: string | null
          name: string
          notes?: string | null
          serial?: string | null
          tag?: string | null
          updated_at?: string
        }
        Update: {
          building_id?: string
          created_at?: string
          equipment_type?: string
          id?: string
          is_active?: boolean
          location?: string | null
          manufacturer?: string | null
          model?: string | null
          name?: string
          notes?: string | null
          serial?: string | null
          tag?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "equipment_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string | null
          full_name: string | null
          home_crew_id: string | null
          is_active: boolean
          primary_category: Database["public"]["Enums"]["category"] | null
          role: Database["public"]["Enums"]["role"]
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          full_name?: string | null
          home_crew_id?: string | null
          is_active?: boolean
          primary_category?: Database["public"]["Enums"]["category"] | null
          role?: Database["public"]["Enums"]["role"]
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          full_name?: string | null
          home_crew_id?: string | null
          is_active?: boolean
          primary_category?: Database["public"]["Enums"]["category"] | null
          role?: Database["public"]["Enums"]["role"]
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_home_crew_id_fkey"
            columns: ["home_crew_id"]
            isOneToOne: false
            referencedRelation: "crews"
            referencedColumns: ["id"]
          },
        ]
      }
      service_reports: {
        Row: {
          building_id: string
          client_summary: string | null
          created_at: string
          created_by: string | null
          id: string
          internal_notes: string | null
          report_date: string
          sent_at: string | null
          sent_by: string | null
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          building_id: string
          client_summary?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          internal_notes?: string | null
          report_date: string
          sent_at?: string | null
          sent_by?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          building_id?: string
          client_summary?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          internal_notes?: string | null
          report_date?: string
          sent_at?: string | null
          sent_by?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "service_reports_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
        ]
      }
      template_items: {
        Row: {
          id: string
          item_type: string
          label: string
          required: boolean | null
          sort_order: number
          template_id: string | null
        }
        Insert: {
          id?: string
          item_type: string
          label: string
          required?: boolean | null
          sort_order?: number
          template_id?: string | null
        }
        Update: {
          id?: string
          item_type?: string
          label?: string
          required?: boolean | null
          sort_order?: number
          template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "template_items_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "visit_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      visit_responses: {
        Row: {
          created_at: string | null
          created_by: string | null
          equipment_id: string | null
          id: string
          item_id: string | null
          value_bool: boolean | null
          value_number: number | null
          value_text: string | null
          visit_id: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          equipment_id?: string | null
          id?: string
          item_id?: string | null
          value_bool?: boolean | null
          value_number?: number | null
          value_text?: string | null
          visit_id?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          equipment_id?: string | null
          id?: string
          item_id?: string | null
          value_bool?: boolean | null
          value_number?: number | null
          value_text?: string | null
          visit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "visit_responses_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visit_responses_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "template_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visit_responses_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "visits"
            referencedColumns: ["id"]
          },
        ]
      }
      visit_templates: {
        Row: {
          category: Database["public"]["Enums"]["category"]
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
        }
        Insert: {
          category: Database["public"]["Enums"]["category"]
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
        }
        Update: {
          category?: Database["public"]["Enums"]["category"]
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
        }
        Relationships: []
      }
      visits: {
        Row: {
          assigned_crew_id: string | null
          assigned_tech_user_id: string | null
          building_id: string | null
          completed_at: string | null
          completed_by: string | null
          created_at: string | null
          id: string
          scheduled_for: string
          started_at: string | null
          status: Database["public"]["Enums"]["visit_status"]
          template_id: string | null
          updated_at: string | null
        }
        Insert: {
          assigned_crew_id?: string | null
          assigned_tech_user_id?: string | null
          building_id?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string | null
          id?: string
          scheduled_for: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["visit_status"]
          template_id?: string | null
          updated_at?: string | null
        }
        Update: {
          assigned_crew_id?: string | null
          assigned_tech_user_id?: string | null
          building_id?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string | null
          id?: string
          scheduled_for?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["visit_status"]
          template_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "visits_assigned_crew_id_fkey"
            columns: ["assigned_crew_id"]
            isOneToOne: false
            referencedRelation: "crews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visits_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visits_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "visit_templates"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      visit_latest_responses: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string | null
          item_id: string | null
          value_bool: boolean | null
          value_number: number | null
          value_text: string | null
          visit_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "visit_responses_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "template_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visit_responses_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "visits"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      get_user_role:
        | { Args: never; Returns: string }
        | {
            Args: { user_uuid: string }
            Returns: Database["public"]["Enums"]["role"]
          }
    }
    Enums: {
      category: "pump" | "fire"
      emergency_status: "open" | "dispatched" | "resolved"
      frequency: "monthly" | "bimonthly"
      obs_status: "open" | "quoted" | "approved" | "in_progress" | "closed"
      role: "tech" | "ops_manager" | "director"
      visit_status: "planned" | "in_progress" | "completed" | "missed"
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
      category: ["pump", "fire"],
      emergency_status: ["open", "dispatched", "resolved"],
      frequency: ["monthly", "bimonthly"],
      obs_status: ["open", "quoted", "approved", "in_progress", "closed"],
      role: ["tech", "ops_manager", "director"],
      visit_status: ["planned", "in_progress", "completed", "missed"],
    },
  },
} as const
