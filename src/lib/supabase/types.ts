export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      colleges: {
        Row: {
          id: string;
          name: string;
          slug: string;
          location: string | null;
          state: string | null;
          acceptance_rate: number | null;
          website_url: string | null;
          logo_url: string | null;
          college_type: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          name: string;
          slug: string;
          location?: string | null;
          state?: string | null;
          acceptance_rate?: number | null;
          website_url?: string | null;
          logo_url?: string | null;
          college_type?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          slug?: string;
          location?: string | null;
          state?: string | null;
          acceptance_rate?: number | null;
          website_url?: string | null;
          logo_url?: string | null;
          college_type?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      user_colleges: {
        Row: {
          id: string;
          user_id: string;
          college_id: string;
          application_status: string;
          application_round: string;
          decision: string | null;
          admissions_category: string | null;
          personal_deadline: string | null;
          notes: string;
          sort_order: number | null;
          added_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          college_id: string;
          application_status?: string;
          application_round?: string;
          decision?: string | null;
          admissions_category?: string | null;
          personal_deadline?: string | null;
          notes?: string;
          sort_order?: number | null;
          added_at?: string;
          updated_at?: string;
        };
        Update: {
          college_id?: string;
          application_status?: string;
          application_round?: string;
          decision?: string | null;
          admissions_category?: string | null;
          personal_deadline?: string | null;
          notes?: string;
          sort_order?: number | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      user_lists: {
        Row: {
          id: string;
          user_id: string;
          colleges: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          colleges: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          colleges?: Json;
          updated_at?: string;
        };
        Relationships: [];
      };
      list_shares: {
        Row: {
          id: string;
          owner_id: string;
          owner_email: string;
          owner_name: string;
          shared_with_email: string;
          shared_with_user_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          owner_email: string;
          owner_name: string;
          shared_with_email: string;
          shared_with_user_id?: string | null;
          created_at?: string;
        };
        Update: {
          shared_with_user_id?: string | null;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          role: "student" | "counselor";
          counselor_id: string | null;
          invite_code: string | null;
          created_at: string;
          plan: "free" | "plus" | "unlimited";
          plan_expires_at: string | null;
          stripe_customer_id: string | null;
          stripe_subscription_id: string | null;
          subscription_status: string | null;
          cancel_at_period_end: boolean;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          role?: "student" | "counselor";
          counselor_id?: string | null;
          invite_code?: string | null;
          created_at?: string;
          plan?: "free" | "plus" | "unlimited";
          plan_expires_at?: string | null;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          subscription_status?: string | null;
          cancel_at_period_end?: boolean;
        };
        Update: {
          email?: string;
          full_name?: string | null;
          role?: "student" | "counselor";
          counselor_id?: string | null;
          invite_code?: string | null;
          plan?: "free" | "plus" | "unlimited";
          plan_expires_at?: string | null;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          subscription_status?: string | null;
          cancel_at_period_end?: boolean;
        };
        Relationships: [];
      };
      counselor_college_notes: {
        Row: {
          id: string;
          counselor_id: string;
          student_id: string;
          college_id: string;
          note: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          counselor_id: string;
          student_id: string;
          college_id: string;
          note: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          note?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      activity_feed: {
        Row: {
          id: string;
          student_id: string;
          counselor_id: string;
          type: string;
          college_name: string | null;
          college_id: string | null;
          metadata: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          student_id: string;
          counselor_id: string;
          type: string;
          college_name?: string | null;
          college_id?: string | null;
          metadata?: Json | null;
          created_at?: string;
        };
        Update: Record<string, never>;
        Relationships: [];
      };
      essays: {
        Row: {
          id: string;
          user_id: string;
          college_id: string;
          prompt: string;
          word_limit: number;
          body: string;
          status: "not_started" | "drafting" | "final";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          college_id: string;
          prompt?: string;
          word_limit?: number;
          body?: string;
          status?: "not_started" | "drafting" | "final";
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          prompt?: string;
          word_limit?: number;
          body?: string;
          status?: "not_started" | "drafting" | "final";
          updated_at?: string;
        };
        Relationships: [];
      };
      essay_comments: {
        Row: {
          id: string;
          essay_id: string;
          counselor_id: string;
          text: string;
          start_offset: number;
          end_offset: number;
          color_index: number;
          resolved: boolean;
          read_by_student: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          essay_id: string;
          counselor_id: string;
          text: string;
          start_offset: number;
          end_offset: number;
          color_index?: number;
          resolved?: boolean;
          read_by_student?: boolean;
          created_at?: string;
        };
        Update: {
          text?: string;
          resolved?: boolean;
          read_by_student?: boolean;
        };
        Relationships: [];
      };
      essay_notes: {
        Row: {
          id: string;
          essay_id: string;
          user_id: string;
          text: string;
          start_offset: number;
          end_offset: number;
          color_index: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          essay_id: string;
          user_id: string;
          text: string;
          start_offset: number;
          end_offset: number;
          color_index?: number;
          created_at?: string;
        };
        Update: {
          text?: string;
        };
        Relationships: [];
      };
      assistant_messages: {
        Row: {
          id: string;
          user_id: string;
          role: "user" | "assistant";
          content: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          role: "user" | "assistant";
          content: string;
          created_at?: string;
        };
        Update: {
          role?: "user" | "assistant";
          content?: string;
        };
        Relationships: [];
      };
      assistant_digests: {
        Row: {
          id: string;
          user_id: string;
          content: string;
          generated_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          content: string;
          generated_at?: string;
          updated_at?: string;
        };
        Update: {
          content?: string;
          generated_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      api_rate_limits: {
        Row: {
          id: string;
          user_id: string | null;
          endpoint: string;
          created_at: string;
          key: string | null;
          cost_cents: number | null;
          billable: boolean;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          endpoint: string;
          created_at?: string;
          key?: string | null;
          cost_cents?: number | null;
          billable?: boolean;
        };
        Update: {
          endpoint?: string;
          created_at?: string;
          key?: string | null;
          cost_cents?: number | null;
          billable?: boolean;
        };
        Relationships: [];
      };
      webhook_events: {
        Row: {
          id: string;
          source: string;
          processed_at: string;
        };
        Insert: {
          id: string;
          source: string;
          processed_at?: string;
        };
        Update: {
          source?: string;
          processed_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}
