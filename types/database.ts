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
export type VisitStatus = "planned" | "in_progress" | "completed" | "missed";
export type ObsStatus = "open" | "quoted" | "approved" | "in_progress" | "closed";
export type EmergencyStatus = "open" | "dispatched" | "resolved";

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
          lat: number | null;
          lng: number | null;
          service_flags: string | null;
          notes: string | null;
          created_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          address?: string | null;
          lat?: number | null;
          lng?: number | null;
          service_flags?: string | null;
          notes?: string | null;
          created_by: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          address?: string | null;
          lat?: number | null;
          lng?: number | null;
          service_flags?: string | null;
          notes?: string | null;
          created_by?: string;
          created_at?: string;
        };
      };
    };
  };
}

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Crew = Database["public"]["Tables"]["crews"]["Row"];
export type Building = Database["public"]["Tables"]["buildings"]["Row"];
