export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Role = "tech" | "ops_manager" | "director";
export type Category = "pump" | "fire";
export type Frequency = "monthly" | "bimonthly";
export type VisitStatus = "planned" | "in_progress" | "completed";
export type ObsStatus = "open" | "quoted" | "approved" | "in_progress" | "closed";
export type EmergencyStatus = "open" | "dispatched" | "resolved";
export type TemplateItemType = "checkbox" | "number" | "text" | "textarea";

export interface Database {
  public: {
    Tables: {
      crews: {
        Row: {
          id: string;
          name: string;
          category: Category;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          category: Category;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          category?: Category;
          created_at?: string;
        };
      };
      profiles: {
        Row: {
          user_id: string;
          full_name: string | null;
          role: Role;
          primary_category: Category | null;
          home_crew_id: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          full_name?: string | null;
          role?: Role;
          primary_category?: Category | null;
          home_crew_id?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          full_name?: string | null;
          role?: Role;
          primary_category?: Category | null;
          home_crew_id?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      buildings: {
        Row: {
          id: string;
          name: string;
          address: string | null;
          systems: Category[] | null;
          lat: number | null;
          lng: number | null;
          service_flags: string | null;
          notes: string | null;
          created_by: string;
          created_at: string;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          address?: string | null;
          systems?: Category[] | null;
          lat?: number | null;
          lng?: number | null;
          service_flags?: string | null;
          notes?: string | null;
          created_by: string;
          created_at?: string;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          name?: string;
          address?: string | null;
          systems?: Category[] | null;
          lat?: number | null;
          lng?: number | null;
          service_flags?: string | null;
          notes?: string | null;
          created_by?: string;
          created_at?: string;
          updated_at?: string | null;
        };
      };
      equipment: {
        Row: {
          id: string;
          building_id: string;
          name: string;
          equipment_type: Category;
          is_active: boolean;
          manufacturer: string | null;
          model: string | null;
          serial: string | null;
          location: string | null;
          tag: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          building_id: string;
          name: string;
          equipment_type: Category;
          is_active?: boolean;
          manufacturer?: string | null;
          model?: string | null;
          serial?: string | null;
          location?: string | null;
          tag?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          building_id?: string;
          name?: string;
          equipment_type?: Category;
          is_active?: boolean;
          manufacturer?: string | null;
          model?: string | null;
          serial?: string | null;
          location?: string | null;
          tag?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      service_reports: {
        Row: {
          id: string;
          building_id: string;
          report_date: string;
          status: string;
          client_summary: string | null;
          internal_notes: string | null;
          sent_at: string | null;
          sent_by: string | null;
          created_at: string;
          updated_at: string;
          created_by: string | null;
          updated_by: string | null;
        };
        Insert: {
          id?: string;
          building_id: string;
          report_date: string;
          status?: string;
          client_summary?: string | null;
          internal_notes?: string | null;
          sent_at?: string | null;
          sent_by?: string | null;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
          updated_by?: string | null;
        };
        Update: {
          id?: string;
          building_id?: string;
          report_date?: string;
          status?: string;
          client_summary?: string | null;
          internal_notes?: string | null;
          sent_at?: string | null;
          sent_by?: string | null;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
          updated_by?: string | null;
        };
      };
      visit_templates: {
        Row: {
          id: string;
          name: string;
          category: Category;
          is_active: boolean | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          category: Category;
          is_active?: boolean | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          category?: Category;
          is_active?: boolean | null;
          created_at?: string;
        };
      };
      template_items: {
        Row: {
          id: string;
          template_id: string | null;
          label: string;
          item_type: TemplateItemType;
          required: boolean | null;
          sort_order: number;
        };
        Insert: {
          id?: string;
          template_id?: string | null;
          label: string;
          item_type: TemplateItemType;
          required?: boolean | null;
          sort_order?: number;
        };
        Update: {
          id?: string;
          template_id?: string | null;
          label?: string;
          item_type?: TemplateItemType;
          required?: boolean | null;
          sort_order?: number;
        };
      };
      visits: {
        Row: {
          id: string;
          building_id: string | null;
          template_id: string | null;
          scheduled_for: string;
          status: VisitStatus;
          assigned_crew_id: string | null;
          assigned_tech_user_id: string | null;
          started_at: string | null;
          completed_at: string | null;
          completed_by: string | null;
          created_at: string;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          building_id?: string | null;
          template_id?: string | null;
          scheduled_for: string;
          status?: VisitStatus;
          assigned_crew_id?: string | null;
          assigned_tech_user_id?: string | null;
          started_at?: string | null;
          completed_at?: string | null;
          completed_by?: string | null;
          created_at?: string;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          building_id?: string | null;
          template_id?: string | null;
          scheduled_for?: string;
          status?: VisitStatus;
          assigned_crew_id?: string | null;
          assigned_tech_user_id?: string | null;
          started_at?: string | null;
          completed_at?: string | null;
          completed_by?: string | null;
          created_at?: string;
          updated_at?: string | null;
        };
      };
      visit_responses: {
        Row: {
          id: string;
          visit_id: string | null;
          item_id: string | null;
          equipment_id: string | null;
          value_text: string | null;
          value_number: number | null;
          value_bool: boolean | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          visit_id?: string | null;
          item_id?: string | null;
          equipment_id?: string | null;
          value_text?: string | null;
          value_number?: number | null;
          value_bool?: boolean | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          visit_id?: string | null;
          item_id?: string | null;
          equipment_id?: string | null;
          value_text?: string | null;
          value_number?: number | null;
          value_bool?: boolean | null;
          created_at?: string;
        };
      };
    };
  };
}

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Crew = Database["public"]["Tables"]["crews"]["Row"];
export type Building = Database["public"]["Tables"]["buildings"]["Row"];
export type Equipment = Database["public"]["Tables"]["equipment"]["Row"];