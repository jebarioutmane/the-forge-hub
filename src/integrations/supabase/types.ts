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
      app_settings: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      budget_categories: {
        Row: {
          created_at: string | null
          id: string
          name: string
          total_amount: number | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          total_amount?: number | null
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          total_amount?: number | null
        }
        Relationships: []
      }
      budget_lines: {
        Row: {
          allocated_amount: number | null
          code: string | null
          cohort_id: string | null
          created_at: string | null
          id: string
          name: string
        }
        Insert: {
          allocated_amount?: number | null
          code?: string | null
          cohort_id?: string | null
          created_at?: string | null
          id?: string
          name: string
        }
        Update: {
          allocated_amount?: number | null
          code?: string | null
          cohort_id?: string | null
          created_at?: string | null
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "budget_lines_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "cohorts"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_transactions: {
        Row: {
          amount: number
          category: string
          cohort_year: string
          created_at: string
          date: string
          description: string | null
          evidence_url: string | null
          id: string
          transaction_type: string
        }
        Insert: {
          amount?: number
          category: string
          cohort_year: string
          created_at?: string
          date?: string
          description?: string | null
          evidence_url?: string | null
          id?: string
          transaction_type: string
        }
        Update: {
          amount?: number
          category?: string
          cohort_year?: string
          created_at?: string
          date?: string
          description?: string | null
          evidence_url?: string | null
          id?: string
          transaction_type?: string
        }
        Relationships: []
      }
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
      cohorts: {
        Row: {
          created_at: string | null
          end_date: string | null
          id: string
          is_archived: boolean
          label: string
          name: string
          start_date: string | null
          total_budget: number | null
          year: number
        }
        Insert: {
          created_at?: string | null
          end_date?: string | null
          id?: string
          is_archived?: boolean
          label: string
          name: string
          start_date?: string | null
          total_budget?: number | null
          year: number
        }
        Update: {
          created_at?: string | null
          end_date?: string | null
          id?: string
          is_archived?: boolean
          label?: string
          name?: string
          start_date?: string | null
          total_budget?: number | null
          year?: number
        }
        Relationships: []
      }
      contract_documents: {
        Row: {
          contract_id: string
          created_at: string | null
          file_name: string
          file_url: string
          id: string
        }
        Insert: {
          contract_id: string
          created_at?: string | null
          file_name: string
          file_url: string
          id?: string
        }
        Update: {
          contract_id?: string
          created_at?: string | null
          file_name?: string
          file_url?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contract_documents_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_links: {
        Row: {
          contract_id: string
          created_at: string | null
          id: string
          title: string | null
          url: string
        }
        Insert: {
          contract_id: string
          created_at?: string | null
          id?: string
          title?: string | null
          url: string
        }
        Update: {
          contract_id?: string
          created_at?: string | null
          id?: string
          title?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "contract_links_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_milestones: {
        Row: {
          contract_id: string
          created_at: string | null
          description: string | null
          due_date: string | null
          id: string
          payment_amount: number | null
          status: string
          title: string
        }
        Insert: {
          contract_id: string
          created_at?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          payment_amount?: number | null
          status?: string
          title: string
        }
        Update: {
          contract_id?: string
          created_at?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          payment_amount?: number | null
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "contract_milestones_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_payments: {
        Row: {
          amount: number
          contract_id: string
          created_at: string | null
          expense_id: string | null
          id: string
          payment_date: string | null
          status: string
        }
        Insert: {
          amount?: number
          contract_id: string
          created_at?: string | null
          expense_id?: string | null
          id?: string
          payment_date?: string | null
          status?: string
        }
        Update: {
          amount?: number
          contract_id?: string
          created_at?: string | null
          expense_id?: string | null
          id?: string
          payment_date?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "contract_payments_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_payments_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
        ]
      }
      contracts: {
        Row: {
          budget_line_id: string | null
          cohort_id: string | null
          currency: string | null
          description: string | null
          end_date: string | null
          id: string
          owner_id: string | null
          payment_structure: string | null
          stakeholder_name: string
          start_date: string | null
          status: string | null
          tag_ids: string[] | null
          title: string
          type: string | null
          value: number | null
          vendor_id: string | null
        }
        Insert: {
          budget_line_id?: string | null
          cohort_id?: string | null
          currency?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          owner_id?: string | null
          payment_structure?: string | null
          stakeholder_name: string
          start_date?: string | null
          status?: string | null
          tag_ids?: string[] | null
          title: string
          type?: string | null
          value?: number | null
          vendor_id?: string | null
        }
        Update: {
          budget_line_id?: string | null
          cohort_id?: string | null
          currency?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          owner_id?: string | null
          payment_structure?: string | null
          stakeholder_name?: string
          start_date?: string | null
          status?: string | null
          tag_ids?: string[] | null
          title?: string
          type?: string | null
          value?: number | null
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contracts_budget_line_id_fkey"
            columns: ["budget_line_id"]
            isOneToOne: false
            referencedRelation: "budget_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "cohorts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      countries: {
        Row: {
          emoji: string
          id: string
          name: string
        }
        Insert: {
          emoji: string
          id?: string
          name: string
        }
        Update: {
          emoji?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      event_attendance: {
        Row: {
          created_at: string | null
          event_id: string | null
          founder_id: string | null
          id: string
          notes: string | null
          status: string | null
        }
        Insert: {
          created_at?: string | null
          event_id?: string | null
          founder_id?: string | null
          id?: string
          notes?: string | null
          status?: string | null
        }
        Update: {
          created_at?: string | null
          event_id?: string | null
          founder_id?: string | null
          id?: string
          notes?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_attendance_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_attendance_founder_id_fkey"
            columns: ["founder_id"]
            isOneToOne: false
            referencedRelation: "founder_engagement"
            referencedColumns: ["founder_id"]
          },
          {
            foreignKeyName: "event_attendance_founder_id_fkey"
            columns: ["founder_id"]
            isOneToOne: false
            referencedRelation: "founders"
            referencedColumns: ["id"]
          },
        ]
      }
      event_logistics: {
        Row: {
          accommodations: Json | null
          caterings: Json | null
          comments: string | null
          created_at: string | null
          event_id: string | null
          id: string
          links: Json | null
          people_involved: string[] | null
          transportations: Json | null
        }
        Insert: {
          accommodations?: Json | null
          caterings?: Json | null
          comments?: string | null
          created_at?: string | null
          event_id?: string | null
          id?: string
          links?: Json | null
          people_involved?: string[] | null
          transportations?: Json | null
        }
        Update: {
          accommodations?: Json | null
          caterings?: Json | null
          comments?: string | null
          created_at?: string | null
          event_id?: string | null
          id?: string
          links?: Json | null
          people_involved?: string[] | null
          transportations?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "event_logistics_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          all_founders: boolean | null
          checklist: Json | null
          cohort_year: string | null
          created_at: string
          created_by: string | null
          end_date: string | null
          end_time: string | null
          event_type: string | null
          expert_id: string | null
          id: string
          linked_founder_id: string | null
          links: Json | null
          location: string | null
          logistics_needs: Json | null
          name: string
          needs: Json | null
          one_on_one_slots: Json | null
          start_date: string | null
          start_time: string | null
          status: string | null
          tag_ids: string[] | null
        }
        Insert: {
          all_founders?: boolean | null
          checklist?: Json | null
          cohort_year?: string | null
          created_at?: string
          created_by?: string | null
          end_date?: string | null
          end_time?: string | null
          event_type?: string | null
          expert_id?: string | null
          id?: string
          linked_founder_id?: string | null
          links?: Json | null
          location?: string | null
          logistics_needs?: Json | null
          name: string
          needs?: Json | null
          one_on_one_slots?: Json | null
          start_date?: string | null
          start_time?: string | null
          status?: string | null
          tag_ids?: string[] | null
        }
        Update: {
          all_founders?: boolean | null
          checklist?: Json | null
          cohort_year?: string | null
          created_at?: string
          created_by?: string | null
          end_date?: string | null
          end_time?: string | null
          event_type?: string | null
          expert_id?: string | null
          id?: string
          linked_founder_id?: string | null
          links?: Json | null
          location?: string | null
          logistics_needs?: Json | null
          name?: string
          needs?: Json | null
          one_on_one_slots?: Json | null
          start_date?: string | null
          start_time?: string | null
          status?: string | null
          tag_ids?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_linked_founder_id_fkey"
            columns: ["linked_founder_id"]
            isOneToOne: false
            referencedRelation: "founder_engagement"
            referencedColumns: ["founder_id"]
          },
          {
            foreignKeyName: "events_linked_founder_id_fkey"
            columns: ["linked_founder_id"]
            isOneToOne: false
            referencedRelation: "founders"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_categories: {
        Row: {
          created_at: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      expense_category_links: {
        Row: {
          category_id: string | null
          expense_id: string | null
          id: string
        }
        Insert: {
          category_id?: string | null
          expense_id?: string | null
          id?: string
        }
        Update: {
          category_id?: string | null
          expense_id?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "expense_category_links_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "expense_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_category_links_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_links: {
        Row: {
          expense_id: string | null
          id: string
          title: string | null
          url: string | null
        }
        Insert: {
          expense_id?: string | null
          id?: string
          title?: string | null
          url?: string | null
        }
        Update: {
          expense_id?: string | null
          id?: string
          title?: string | null
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expense_links_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_stakeholders: {
        Row: {
          expense_id: string | null
          id: string
          vendor_id: string | null
        }
        Insert: {
          expense_id?: string | null
          id?: string
          vendor_id?: string | null
        }
        Update: {
          expense_id?: string | null
          id?: string
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expense_stakeholders_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_stakeholders_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          beneficiary_name: string | null
          budget_line_id: string | null
          category_id: string | null
          cohort_id: string | null
          created_at: string | null
          currency: string | null
          description: string
          due_date: string | null
          id: string
          proof_document_url: string | null
          status: string | null
          tag_ids: string[] | null
          type: string | null
          vendor_id: string | null
        }
        Insert: {
          amount: number
          beneficiary_name?: string | null
          budget_line_id?: string | null
          category_id?: string | null
          cohort_id?: string | null
          created_at?: string | null
          currency?: string | null
          description: string
          due_date?: string | null
          id?: string
          proof_document_url?: string | null
          status?: string | null
          tag_ids?: string[] | null
          type?: string | null
          vendor_id?: string | null
        }
        Update: {
          amount?: number
          beneficiary_name?: string | null
          budget_line_id?: string | null
          category_id?: string | null
          cohort_id?: string | null
          created_at?: string | null
          currency?: string | null
          description?: string
          due_date?: string | null
          id?: string
          proof_document_url?: string | null
          status?: string | null
          tag_ids?: string[] | null
          type?: string | null
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_budget_line_id_fkey"
            columns: ["budget_line_id"]
            isOneToOne: false
            referencedRelation: "budget_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "budget_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "cohorts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      founder_checkins: {
        Row: {
          associate_id: string | null
          checkin_date: string
          checkin_type: string
          created_at: string
          effort_signal: string | null
          founder_id: string
          funding_note: string | null
          funding_rating: number | null
          id: string
          links: Json | null
          market_note: string | null
          market_rating: number | null
          notes: string | null
          overall_score: number | null
          product_note: string | null
          product_rating: number | null
          team_note: string | null
          team_rating: number | null
          traction_note: string | null
          traction_rating: number | null
        }
        Insert: {
          associate_id?: string | null
          checkin_date?: string
          checkin_type?: string
          created_at?: string
          effort_signal?: string | null
          founder_id: string
          funding_note?: string | null
          funding_rating?: number | null
          id?: string
          links?: Json | null
          market_note?: string | null
          market_rating?: number | null
          notes?: string | null
          overall_score?: number | null
          product_note?: string | null
          product_rating?: number | null
          team_note?: string | null
          team_rating?: number | null
          traction_note?: string | null
          traction_rating?: number | null
        }
        Update: {
          associate_id?: string | null
          checkin_date?: string
          checkin_type?: string
          created_at?: string
          effort_signal?: string | null
          founder_id?: string
          funding_note?: string | null
          funding_rating?: number | null
          id?: string
          links?: Json | null
          market_note?: string | null
          market_rating?: number | null
          notes?: string | null
          overall_score?: number | null
          product_note?: string | null
          product_rating?: number | null
          team_note?: string | null
          team_rating?: number | null
          traction_note?: string | null
          traction_rating?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "founder_checkins_associate_id_fkey"
            columns: ["associate_id"]
            isOneToOne: false
            referencedRelation: "venture_associates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "founder_checkins_founder_id_fkey"
            columns: ["founder_id"]
            isOneToOne: false
            referencedRelation: "founder_engagement"
            referencedColumns: ["founder_id"]
          },
          {
            foreignKeyName: "founder_checkins_founder_id_fkey"
            columns: ["founder_id"]
            isOneToOne: false
            referencedRelation: "founders"
            referencedColumns: ["id"]
          },
        ]
      }
      founder_evaluations: {
        Row: {
          block_name: string
          categories_data: Json | null
          created_at: string
          decision: string | null
          evaluation_date: string | null
          execution_score: number | null
          founder_id: string
          id: string
          momentum_score: number | null
          overall_confidence: number | null
          quantitative_metrics: Json | null
          support_required: string[] | null
          total_score: number | null
          traction_score: number | null
        }
        Insert: {
          block_name: string
          categories_data?: Json | null
          created_at?: string
          decision?: string | null
          evaluation_date?: string | null
          execution_score?: number | null
          founder_id: string
          id?: string
          momentum_score?: number | null
          overall_confidence?: number | null
          quantitative_metrics?: Json | null
          support_required?: string[] | null
          total_score?: number | null
          traction_score?: number | null
        }
        Update: {
          block_name?: string
          categories_data?: Json | null
          created_at?: string
          decision?: string | null
          evaluation_date?: string | null
          execution_score?: number | null
          founder_id?: string
          id?: string
          momentum_score?: number | null
          overall_confidence?: number | null
          quantitative_metrics?: Json | null
          support_required?: string[] | null
          total_score?: number | null
          traction_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "founder_evaluations_founder_id_fkey"
            columns: ["founder_id"]
            isOneToOne: false
            referencedRelation: "founder_engagement"
            referencedColumns: ["founder_id"]
          },
          {
            foreignKeyName: "founder_evaluations_founder_id_fkey"
            columns: ["founder_id"]
            isOneToOne: false
            referencedRelation: "founders"
            referencedColumns: ["id"]
          },
        ]
      }
      founders: {
        Row: {
          birthday: string | null
          cin_number: string | null
          cohort: string | null
          cohort_id: string | null
          cohort_year: string | null
          created_at: string | null
          description: string | null
          email: string | null
          founder_name: string
          id: string
          link_title: string | null
          link_url: string | null
          links: Json | null
          nationalities: string[] | null
          nationality: string | null
          passport_number: string | null
          phone: string | null
          photo_url: string | null
          rib_number: string | null
          startup_name: string
          status: string | null
          tag_ids: string[] | null
          venture_associate: string | null
        }
        Insert: {
          birthday?: string | null
          cin_number?: string | null
          cohort?: string | null
          cohort_id?: string | null
          cohort_year?: string | null
          created_at?: string | null
          description?: string | null
          email?: string | null
          founder_name: string
          id?: string
          link_title?: string | null
          link_url?: string | null
          links?: Json | null
          nationalities?: string[] | null
          nationality?: string | null
          passport_number?: string | null
          phone?: string | null
          photo_url?: string | null
          rib_number?: string | null
          startup_name: string
          status?: string | null
          tag_ids?: string[] | null
          venture_associate?: string | null
        }
        Update: {
          birthday?: string | null
          cin_number?: string | null
          cohort?: string | null
          cohort_id?: string | null
          cohort_year?: string | null
          created_at?: string | null
          description?: string | null
          email?: string | null
          founder_name?: string
          id?: string
          link_title?: string | null
          link_url?: string | null
          links?: Json | null
          nationalities?: string[] | null
          nationality?: string | null
          passport_number?: string | null
          phone?: string | null
          photo_url?: string | null
          rib_number?: string | null
          startup_name?: string
          status?: string | null
          tag_ids?: string[] | null
          venture_associate?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "founders_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "cohorts"
            referencedColumns: ["id"]
          },
        ]
      }
      history_logs: {
        Row: {
          action: string
          changed_by_name: string | null
          created_at: string
          id: string
          new_data: Json | null
          old_data: Json | null
          record_id: string
          section_name: string
        }
        Insert: {
          action: string
          changed_by_name?: string | null
          created_at?: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id: string
          section_name: string
        }
        Update: {
          action?: string
          changed_by_name?: string | null
          created_at?: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string
          section_name?: string
        }
        Relationships: []
      }
      mentoring_sessions: {
        Row: {
          all_founders: boolean | null
          created_at: string
          description: string | null
          founder_name: string
          id: string
          links: Json | null
          mentor_id: string | null
          mentor_name: string
          one_on_one_slots: Json | null
          session_date: string | null
          status: string | null
          time_slot: string | null
          title: string | null
        }
        Insert: {
          all_founders?: boolean | null
          created_at?: string
          description?: string | null
          founder_name: string
          id?: string
          links?: Json | null
          mentor_id?: string | null
          mentor_name: string
          one_on_one_slots?: Json | null
          session_date?: string | null
          status?: string | null
          time_slot?: string | null
          title?: string | null
        }
        Update: {
          all_founders?: boolean | null
          created_at?: string
          description?: string | null
          founder_name?: string
          id?: string
          links?: Json | null
          mentor_id?: string | null
          mentor_name?: string
          one_on_one_slots?: Json | null
          session_date?: string | null
          status?: string | null
          time_slot?: string | null
          title?: string | null
        }
        Relationships: []
      }
      mentors: {
        Row: {
          created_at: string | null
          email: string | null
          expertise: string | null
          full_name: string
          id: string
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          expertise?: string | null
          full_name: string
          id?: string
        }
        Update: {
          created_at?: string | null
          email?: string | null
          expertise?: string | null
          full_name?: string
          id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          assigned_departments: string[] | null
          avatar_url: string | null
          birthday: string | null
          cin_number: string | null
          date_joined: string | null
          description: string | null
          email: string | null
          full_name: string | null
          id: string
          links: Json | null
          nationalities: string[] | null
          passport_number: string | null
          phone: string | null
          role: string | null
          status: string | null
          status_note: string | null
          status_until: string | null
          tags: string[] | null
          title: string | null
          updated_at: string | null
        }
        Insert: {
          assigned_departments?: string[] | null
          avatar_url?: string | null
          birthday?: string | null
          cin_number?: string | null
          date_joined?: string | null
          description?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          links?: Json | null
          nationalities?: string[] | null
          passport_number?: string | null
          phone?: string | null
          role?: string | null
          status?: string | null
          status_note?: string | null
          status_until?: string | null
          tags?: string[] | null
          title?: string | null
          updated_at?: string | null
        }
        Update: {
          assigned_departments?: string[] | null
          avatar_url?: string | null
          birthday?: string | null
          cin_number?: string | null
          date_joined?: string | null
          description?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          links?: Json | null
          nationalities?: string[] | null
          passport_number?: string | null
          phone?: string | null
          role?: string | null
          status?: string | null
          status_note?: string | null
          status_until?: string | null
          tags?: string[] | null
          title?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      resource_library: {
        Row: {
          created_at: string
          description: string | null
          id: string
          module_name: string
          resource_name: string
          url: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          module_name: string
          resource_name: string
          url: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          module_name?: string
          resource_name?: string
          url?: string
        }
        Relationships: []
      }
      stakeholders: {
        Row: {
          based_in_country: string | null
          created_at: string | null
          description: string | null
          email: string | null
          full_name: string
          id: string
          institution_name: string | null
          links: Json | null
          nationalities: string[] | null
          phone: string | null
          point_of_contact: string | null
          sector: string | null
          status: string | null
          title: string | null
          type: string | null
        }
        Insert: {
          based_in_country?: string | null
          created_at?: string | null
          description?: string | null
          email?: string | null
          full_name: string
          id?: string
          institution_name?: string | null
          links?: Json | null
          nationalities?: string[] | null
          phone?: string | null
          point_of_contact?: string | null
          sector?: string | null
          status?: string | null
          title?: string | null
          type?: string | null
        }
        Update: {
          based_in_country?: string | null
          created_at?: string | null
          description?: string | null
          email?: string | null
          full_name?: string
          id?: string
          institution_name?: string | null
          links?: Json | null
          nationalities?: string[] | null
          phone?: string | null
          point_of_contact?: string | null
          sector?: string | null
          status?: string | null
          title?: string | null
          type?: string | null
        }
        Relationships: []
      }
      stipend_records: {
        Row: {
          addition_fixed: number | null
          addition_percent: number | null
          base_amount: number | null
          cohort_year: string
          created_at: string | null
          deduction_fixed: number | null
          deduction_percent: number | null
          founder_id: string | null
          id: string
          notes: string | null
          payment_month: string
          reimbursement: number | null
          status: string | null
          stipend_links: Json | null
          total_net: number | null
        }
        Insert: {
          addition_fixed?: number | null
          addition_percent?: number | null
          base_amount?: number | null
          cohort_year: string
          created_at?: string | null
          deduction_fixed?: number | null
          deduction_percent?: number | null
          founder_id?: string | null
          id?: string
          notes?: string | null
          payment_month: string
          reimbursement?: number | null
          status?: string | null
          stipend_links?: Json | null
          total_net?: number | null
        }
        Update: {
          addition_fixed?: number | null
          addition_percent?: number | null
          base_amount?: number | null
          cohort_year?: string
          created_at?: string | null
          deduction_fixed?: number | null
          deduction_percent?: number | null
          founder_id?: string | null
          id?: string
          notes?: string | null
          payment_month?: string
          reimbursement?: number | null
          status?: string | null
          stipend_links?: Json | null
          total_net?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "stipend_records_founder_id_fkey"
            columns: ["founder_id"]
            isOneToOne: false
            referencedRelation: "founder_engagement"
            referencedColumns: ["founder_id"]
          },
          {
            foreignKeyName: "stipend_records_founder_id_fkey"
            columns: ["founder_id"]
            isOneToOne: false
            referencedRelation: "founders"
            referencedColumns: ["id"]
          },
        ]
      }
      tags: {
        Row: {
          color: string
          created_at: string | null
          id: string
          name: string
        }
        Insert: {
          color?: string
          created_at?: string | null
          id?: string
          name: string
        }
        Update: {
          color?: string
          created_at?: string | null
          id?: string
          name?: string
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
      vendors: {
        Row: {
          created_at: string | null
          email: string | null
          id: string
          name: string
          rate: number | null
          type: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          id?: string
          name: string
          rate?: number | null
          type?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          id?: string
          name?: string
          rate?: number | null
          type?: string | null
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
      founder_engagement: {
        Row: {
          attendance_rate: number | null
          cohort_id: string | null
          days_since_last_checkin: number | null
          events_attended: number | null
          events_recorded: number | null
          founder_id: string | null
          founder_name: string | null
          last_checkin_date: string | null
          latest_effort_signal: string | null
          risk_status: string | null
          startup_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "founders_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "cohorts"
            referencedColumns: ["id"]
          },
        ]
      }
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
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      text_to_bytea: { Args: { data: string }; Returns: string }
      update_user_role: {
        Args: { _new_role: string; _target_id: string }
        Returns: undefined
      }
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
