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
        Update: Partial<Database["public"]["Tables"]["colleges"]["Insert"]>;
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
        Update: Partial<
          Omit<Database["public"]["Tables"]["user_colleges"]["Insert"], "id" | "user_id">
        >;
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
        Update: Partial<Database["public"]["Tables"]["user_lists"]["Insert"]>;
        Relationships: [];
      };
      list_shares: {
        Row: {
          id: string;
          owner_id: string;
          owner_email: string;
          shared_with_email: string;
          shared_with_user_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          owner_email: string;
          shared_with_email: string;
          shared_with_user_id?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["list_shares"]["Insert"]>;
        Relationships: [];
      };
    };
  };
}
