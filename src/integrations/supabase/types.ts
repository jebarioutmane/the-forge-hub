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
      budgets: {
        Row: {
          category: string
          created_at: string | null
          currency: string | null
          fiscal_year: number | null
          id: string
          total_amount: number
        }
        Insert: {
          category: string
          created_at?: string | null
          currency?: string | null
          fiscal_year?: number | null
          id?: string
          total_amount: number
        }
        Update: {
          category?: string
          created_at?: string | null
          currency?: string | null
          fiscal_year?: number | null
          id?: string
          total_amount?: number
        }
        Relationships: []
      }
      contracts: {
        Row: {
          end_date: string | null
          id: string
          owner_id: string | null
          stakeholder_name: string
          start_date: string | null
          status: string | null
          title: string
          type: string | null
          value: number | null
        }
        Insert: {
          end_date?: string | null
          id?: string
          owner_id?: string | null
          stakeholder_name: string
          start_date?: string | null
          status?: string | null
          title: string
          type?: string | null
          value?: number | null
        }
        Update: {
          end_date?: string | null
          id?: string
          owner_id?: string | null
          stakeholder_name?: string
          start_date?: string | null
          status?: string | null
          title?: string
          type?: string | null
          value?: number | null
        }
        Relationships: []
      }
      events: {
        Row: {
          checklist: Json | null
          created_at: string
          end_date: string | null
          event_type: string | null
          id: string
          name: string
          needs: Json | null
          start_date: string | null
          status: string | null
        }
        Insert: {
          checklist?: Json | null
          created_at?: string
          end_date?: string | null
          event_type?: string | null
          id?: string
          name: string
          needs?: Json | null
          start_date?: string | null
          status?: string | null
        }
        Update: {
          checklist?: Json | null
          created_at?: string
          end_date?: string | null
          event_type?: string | null
          id?: string
          name?: string
          needs?: Json | null
          start_date?: string | null
          status?: string | null
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount: number
          beneficiary_name: string | null
          budget_id: string | null
          created_at: string | null
          currency: string | null
          description: string
          due_date: string | null
          id: string
          proof_document_url: string | null
          status: string | null
          type: string | null
        }
        Insert: {
          amount: number
          beneficiary_name?: string | null
          budget_id?: string | null
          created_at?: string | null
          currency?: string | null
          description: string
          due_date?: string | null
          id?: string
          proof_document_url?: string | null
          status?: string | null
          type?: string | null
        }
        Update: {
          amount?: number
          beneficiary_name?: string | null
          budget_id?: string | null
          created_at?: string | null
          currency?: string | null
          description?: string
          due_date?: string | null
          id?: string
          proof_document_url?: string | null
          status?: string | null
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_budget_id_fkey"
            columns: ["budget_id"]
            isOneToOne: false
            referencedRelation: "budgets"
            referencedColumns: ["id"]
          },
        ]
      }
      founders: {
        Row: {
          cohort: string | null
          created_at: string | null
          founder_name: string
          id: string
          startup_name: string
        }
        Insert: {
          cohort?: string | null
          created_at?: string | null
          founder_name: string
          id?: string
          startup_name: string
        }
        Update: {
          cohort?: string | null
          created_at?: string | null
          founder_name?: string
          id?: string
          startup_name?: string
        }
        Relationships: []
      }
      founders_tracking: {
        Row: {
          associate_id: string | null
          clients_traction_rating: number | null
          clients_traction_update: string | null
          created_at: string | null
          founder_id: string | null
          funding_update: string | null
          funding_update_rating: number | null
          id: string
          market_presence_rating: number | null
          market_presence_update: string | null
          other_updates: string | null
          product_dev_rating: number | null
          product_dev_update: string | null
          team_structure_rating: number | null
          team_structure_update: string | null
          tracking_date: string | null
        }
        Insert: {
          associate_id?: string | null
          clients_traction_rating?: number | null
          clients_traction_update?: string | null
          created_at?: string | null
          founder_id?: string | null
          funding_update?: string | null
          funding_update_rating?: number | null
          id?: string
          market_presence_rating?: number | null
          market_presence_update?: string | null
          other_updates?: string | null
          product_dev_rating?: number | null
          product_dev_update?: string | null
          team_structure_rating?: number | null
          team_structure_update?: string | null
          tracking_date?: string | null
        }
        Update: {
          associate_id?: string | null
          clients_traction_rating?: number | null
          clients_traction_update?: string | null
          created_at?: string | null
          founder_id?: string | null
          funding_update?: string | null
          funding_update_rating?: number | null
          id?: string
          market_presence_rating?: number | null
          market_presence_update?: string | null
          other_updates?: string | null
          product_dev_rating?: number | null
          product_dev_update?: string | null
          team_structure_rating?: number | null
          team_structure_update?: string | null
          tracking_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "founders_tracking_associate_id_fkey"
            columns: ["associate_id"]
            isOneToOne: false
            referencedRelation: "venture_associates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "founders_tracking_founder_id_fkey"
            columns: ["founder_id"]
            isOneToOne: false
            referencedRelation: "founders"
            referencedColumns: ["id"]
          },
        ]
      }
      mentoring_sessions: {
        Row: {
          created_at: string
          founder_name: string
          id: string
          mentor_name: string
          session_date: string | null
          time_slot: string | null
        }
        Insert: {
          created_at?: string
          founder_name: string
          id?: string
          mentor_name: string
          session_date?: string | null
          time_slot?: string | null
        }
        Update: {
          created_at?: string
          founder_name?: string
          id?: string
          mentor_name?: string
          session_date?: string | null
          time_slot?: string | null
        }
        Relationships: []
      }
      resource_library: {
        Row: {
          created_at: string
          id: string
          module_name: string
          resource_name: string
          url: string
        }
        Insert: {
          created_at?: string
          id?: string
          module_name: string
          resource_name: string
          url: string
        }
        Update: {
          created_at?: string
          id?: string
          module_name?: string
          resource_name?: string
          url?: string
        }
        Relationships: []
      }
      stipends: {
        Row: {
          base_amount: number
          created_at: string
          deductions: number
          final_payout: number | null
          founder_name: string
          id: string
          status: string
        }
        Insert: {
          base_amount: number
          created_at?: string
          deductions?: number
          final_payout?: number | null
          founder_name: string
          id?: string
          status?: string
        }
        Update: {
          base_amount?: number
          created_at?: string
          deductions?: number
          final_payout?: number | null
          founder_name?: string
          id?: string
          status?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          assigned_to: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          due_date: string | null
          id: string
          priority: string | null
          source_id: string | null
          source_module: string | null
          status: string | null
          title: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: string | null
          source_id?: string | null
          source_module?: string | null
          status?: string | null
          title: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: string | null
          source_id?: string | null
          source_module?: string | null
          status?: string | null
          title?: string
        }
        Relationships: []
      }
      venture_associates: {
        Row: {
          created_at: string | null
          full_name: string
          id: string
        }
        Insert: {
          created_at?: string | null
          full_name: string
          id?: string
        }
        Update: {
          created_at?: string | null
          full_name?: string
          id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      bytea_to_text: { Args: { data: string }; Returns: string }
      http: {
        Args: { request: Database["public"]["CompositeTypes"]["http_request"] }
        Returns: Database["public"]["CompositeTypes"]["http_response"]
        SetofOptions: {
          from: "http_request"
          to: "http_response"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      http_delete:
        | {
            Args: { uri: string }
            Returns: Database["public"]["CompositeTypes"]["http_response"]
            SetofOptions: {
              from: "*"
              to: "http_response"
              isOneToOne: true
              isSetofReturn: false
            }
          }
        | {
            Args: { content: string; content_type: string; uri: string }
            Returns: Database["public"]["CompositeTypes"]["http_response"]
            SetofOptions: {
              from: "*"
              to: "http_response"
              isOneToOne: true
              isSetofReturn: false
            }
          }
      http_get:
        | {
            Args: { uri: string }
            Returns: Database["public"]["CompositeTypes"]["http_response"]
            SetofOptions: {
              from: "*"
              to: "http_response"
              isOneToOne: true
              isSetofReturn: false
            }
          }
        | {
            Args: { data: Json; uri: string }
            Returns: Database["public"]["CompositeTypes"]["http_response"]
            SetofOptions: {
              from: "*"
              to: "http_response"
              isOneToOne: true
              isSetofReturn: false
            }
          }
      http_head: {
        Args: { uri: string }
        Returns: Database["public"]["CompositeTypes"]["http_response"]
        SetofOptions: {
          from: "*"
          to: "http_response"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      http_header: {
        Args: { field: string; value: string }
        Returns: Database["public"]["CompositeTypes"]["http_header"]
        SetofOptions: {
          from: "*"
          to: "http_header"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      http_list_curlopt: {
        Args: never
        Returns: {
          curlopt: string
          value: string
        }[]
      }
      http_patch: {
        Args: { content: string; content_type: string; uri: string }
        Returns: Database["public"]["CompositeTypes"]["http_response"]
        SetofOptions: {
          from: "*"
          to: "http_response"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      http_post:
        | {
            Args: { content: string; content_type: string; uri: string }
            Returns: Database["public"]["CompositeTypes"]["http_response"]
            SetofOptions: {
              from: "*"
              to: "http_response"
              isOneToOne: true
              isSetofReturn: false
            }
          }
        | {
            Args: { data: Json; uri: string }
            Returns: Database["public"]["CompositeTypes"]["http_response"]
            SetofOptions: {
              from: "*"
              to: "http_response"
              isOneToOne: true
              isSetofReturn: false
            }
          }
      http_put: {
        Args: { content: string; content_type: string; uri: string }
        Returns: Database["public"]["CompositeTypes"]["http_response"]
        SetofOptions: {
          from: "*"
          to: "http_response"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      http_reset_curlopt: { Args: never; Returns: boolean }
      http_set_curlopt: {
        Args: { curlopt: string; value: string }
        Returns: boolean
      }
      text_to_bytea: { Args: { data: string }; Returns: string }
      urlencode:
        | { Args: { data: Json }; Returns: string }
        | {
            Args: { string: string }
            Returns: {
              error: true
            } & "Could not choose the best candidate function between: public.urlencode(string => bytea), public.urlencode(string => varchar). Try renaming the parameters or the function itself in the database so function overloading can be resolved"
          }
        | {
            Args: { string: string }
            Returns: {
              error: true
            } & "Could not choose the best candidate function between: public.urlencode(string => bytea), public.urlencode(string => varchar). Try renaming the parameters or the function itself in the database so function overloading can be resolved"
          }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      http_header: {
        field: string | null
        value: string | null
      }
      http_request: {
        method: unknown
        uri: string | null
        headers: Database["public"]["CompositeTypes"]["http_header"][] | null
        content_type: string | null
        content: string | null
      }
      http_response: {
        status: number | null
        content_type: string | null
        headers: Database["public"]["CompositeTypes"]["http_header"][] | null
        content: string | null
      }
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
