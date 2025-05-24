export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      attendance_logs: {
        Row: {
          created_at: string
          event_type: Database["public"]["Enums"]["attendance_event_type"]
          id: string
          timestamp: string
          user_id: string
        }
        Insert: {
          created_at?: string
          event_type: Database["public"]["Enums"]["attendance_event_type"]
          id?: string
          timestamp?: string
          user_id: string
        }
        Update: {
          created_at?: string
          event_type?: Database["public"]["Enums"]["attendance_event_type"]
          id?: string
          timestamp?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          role: string | null
          updated_at: string | null
          department_id: string | null
          phone_number: string | null
          address: string | null
          date_of_birth: string | null
          profile_picture_url: string | null
          health_card_url: string | null
          emergency_contact_name: string | null
          emergency_contact_relationship: string | null
          emergency_contact_phone: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          role?: string | null
          updated_at?: string | null
          department_id?: string | null
          phone_number?: string | null
          address?: string | null
          date_of_birth?: string | null
          profile_picture_url?: string | null
          health_card_url?: string | null
          emergency_contact_name?: string | null
          emergency_contact_relationship?: string | null
          emergency_contact_phone?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          role?: string | null
          updated_at?: string | null
          department_id?: string | null
          phone_number?: string | null
          address?: string | null
          date_of_birth?: string | null
          profile_picture_url?: string | null
          health_card_url?: string | null
          emergency_contact_name?: string | null
          emergency_contact_relationship?: string | null
          emergency_contact_phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          }
        ]
      }
      departments: {
        Row: {
          id: string
          name: string
          description: string | null
          created_at: string
          updated_at: string
          shift_start_time: string | null
          shift_end_time: string | null
          grace_period_minutes: number | null
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          created_at?: string
          updated_at?: string
          shift_start_time?: string | null
          shift_end_time?: string | null
          grace_period_minutes?: number | null
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          created_at?: string
          updated_at?: string
          shift_start_time?: string | null
          shift_end_time?: string | null
          grace_period_minutes?: number | null
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          id: number
          company_name: string | null
          default_hours: number | null
          timezone: string | null
          created_at: string
        }
        Insert: {
          id?: number
          company_name?: string | null
          default_hours?: number | null
          timezone?: string | null
          created_at?: string
        }
        Update: {
          id?: number
          company_name?: string | null
          default_hours?: number | null
          timezone?: string | null
          created_at?: string
        }
        Relationships: []
      }
      qr_configs: {
        Row: {
          id: number
          location_identifier: string
          qr_value: string // Stores the full value like TIMESCAN-LOC:Entrance
          created_at: string
          created_by: string | null // Optional: Track who created it
        }
        Insert: {
          id?: number
          location_identifier: string
          qr_value: string
          created_at?: string
          created_by?: string | null
        }
        Update: { // Unlikely needed, but good practice
          id?: number
          location_identifier?: string
          qr_value?: string
          created_at?: string
          created_by?: string | null
        }
        Relationships: [
          {
            // Optional relationship to profiles if created_by is used
            foreignKeyName: "qr_configs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      attendance_adherence: {
        Row: {
          id: string
          user_id: string
          date: string
          status: Database["public"]["Enums"]["adherence_status"]
          marked_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          date: string
          status: Database["public"]["Enums"]["adherence_status"]
          marked_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          date?: string
          status?: Database["public"]["Enums"]["adherence_status"]
          marked_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_adherence_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_adherence_marked_by_fkey"
            columns: ["marked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      attendance_event_type: "signin" | "signout" | "break_start" | "break_end"
      user_role: "employee" | "manager" | "admin"
      adherence_status: "early" | "on_time" | "late" | "absent" | "pending"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']
export type Enums<T extends keyof Database['public']['Enums']> = Database['public']['Enums'][T]
