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
      admin_activity_logs: {
        Row: {
          action: string
          action_type: string
          admin_id: string
          created_at: string
          details: Json | null
          id: string
          ip_address: string | null
          target_id: string | null
          target_name: string | null
          target_type: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          action_type?: string
          admin_id: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          target_id?: string | null
          target_name?: string | null
          target_type?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          action_type?: string
          admin_id?: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          target_id?: string | null
          target_name?: string | null
          target_type?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      agent_commands: {
        Row: {
          agent_id: string
          command: string
          completed_at: string | null
          created_at: string
          created_by: string
          cwd: string | null
          exit_code: number | null
          id: string
          started_at: string | null
          status: string
          stderr: string | null
          stdout: string | null
          timeout_seconds: number
        }
        Insert: {
          agent_id: string
          command: string
          completed_at?: string | null
          created_at?: string
          created_by: string
          cwd?: string | null
          exit_code?: number | null
          id?: string
          started_at?: string | null
          status?: string
          stderr?: string | null
          stdout?: string | null
          timeout_seconds?: number
        }
        Update: {
          agent_id?: string
          command?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string
          cwd?: string | null
          exit_code?: number | null
          id?: string
          started_at?: string | null
          status?: string
          stderr?: string | null
          stdout?: string | null
          timeout_seconds?: number
        }
        Relationships: [
          {
            foreignKeyName: "agent_commands_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_tasks: {
        Row: {
          agent_id: string
          completed_at: string | null
          created_at: string
          error_message: string | null
          execution_time_ms: number | null
          expires_at: string | null
          id: string
          max_retries: number
          payload: Json
          priority: number
          result: Json | null
          retry_count: number
          started_at: string | null
          status: Database["public"]["Enums"]["agent_task_status"]
          step_results: Json | null
          target_id: string
          target_type: string
          task_type: Database["public"]["Enums"]["agent_task_type"]
          timeout_at: string | null
        }
        Insert: {
          agent_id: string
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          execution_time_ms?: number | null
          expires_at?: string | null
          id?: string
          max_retries?: number
          payload?: Json
          priority?: number
          result?: Json | null
          retry_count?: number
          started_at?: string | null
          status?: Database["public"]["Enums"]["agent_task_status"]
          step_results?: Json | null
          target_id: string
          target_type?: string
          task_type: Database["public"]["Enums"]["agent_task_type"]
          timeout_at?: string | null
        }
        Update: {
          agent_id?: string
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          execution_time_ms?: number | null
          expires_at?: string | null
          id?: string
          max_retries?: number
          payload?: Json
          priority?: number
          result?: Json | null
          retry_count?: number
          started_at?: string | null
          status?: Database["public"]["Enums"]["agent_task_status"]
          step_results?: Json | null
          target_id?: string
          target_type?: string
          task_type?: Database["public"]["Enums"]["agent_task_type"]
          timeout_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_tasks_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
      }
      agents: {
        Row: {
          activation_code: string | null
          activation_code_expires_at: string | null
          agent_version: string | null
          azure_certificate_key_id: string | null
          capabilities: Json | null
          certificate_public_key: string | null
          certificate_thumbprint: string | null
          check_components: boolean
          client_id: string | null
          config_fetched_at: string | null
          config_updated_at: string | null
          created_at: string
          created_by: string | null
          id: string
          is_system_agent: boolean
          jwt_secret: string | null
          last_seen: string | null
          name: string
          revoked: boolean
          shell_session_active: boolean
          supervisor_version: string | null
        }
        Insert: {
          activation_code?: string | null
          activation_code_expires_at?: string | null
          agent_version?: string | null
          azure_certificate_key_id?: string | null
          capabilities?: Json | null
          certificate_public_key?: string | null
          certificate_thumbprint?: string | null
          check_components?: boolean
          client_id?: string | null
          config_fetched_at?: string | null
          config_updated_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_system_agent?: boolean
          jwt_secret?: string | null
          last_seen?: string | null
          name: string
          revoked?: boolean
          shell_session_active?: boolean
          supervisor_version?: string | null
        }
        Update: {
          activation_code?: string | null
          activation_code_expires_at?: string | null
          agent_version?: string | null
          azure_certificate_key_id?: string | null
          capabilities?: Json | null
          certificate_public_key?: string | null
          certificate_thumbprint?: string | null
          check_components?: boolean
          client_id?: string | null
          config_fetched_at?: string | null
          config_updated_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_system_agent?: boolean
          jwt_secret?: string | null
          last_seen?: string | null
          name?: string
          revoked?: boolean
          shell_session_active?: boolean
          supervisor_version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agents_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      analysis_history: {
        Row: {
          analyzed_by: string | null
          created_at: string
          firewall_id: string
          id: string
          report_data: Json
          score: number
        }
        Insert: {
          analyzed_by?: string | null
          created_at?: string
          firewall_id: string
          id?: string
          report_data: Json
          score: number
        }
        Update: {
          analyzed_by?: string | null
          created_at?: string
          firewall_id?: string
          id?: string
          report_data?: Json
          score?: number
        }
        Relationships: [
          {
            foreignKeyName: "analysis_history_firewall_id_fkey"
            columns: ["firewall_id"]
            isOneToOne: false
            referencedRelation: "firewalls"
            referencedColumns: ["id"]
          },
        ]
      }
      analysis_schedules: {
        Row: {
          created_at: string
          created_by: string | null
          firewall_id: string
          frequency: Database["public"]["Enums"]["schedule_frequency"]
          id: string
          is_active: boolean
          next_run_at: string | null
          scheduled_day_of_month: number | null
          scheduled_day_of_week: number | null
          scheduled_hour: number | null
          timezone: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          firewall_id: string
          frequency?: Database["public"]["Enums"]["schedule_frequency"]
          id?: string
          is_active?: boolean
          next_run_at?: string | null
          scheduled_day_of_month?: number | null
          scheduled_day_of_week?: number | null
          scheduled_hour?: number | null
          timezone?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          firewall_id?: string
          frequency?: Database["public"]["Enums"]["schedule_frequency"]
          id?: string
          is_active?: boolean
          next_run_at?: string | null
          scheduled_day_of_month?: number | null
          scheduled_day_of_week?: number | null
          scheduled_hour?: number | null
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "analysis_schedules_firewall_id_fkey"
            columns: ["firewall_id"]
            isOneToOne: true
            referencedRelation: "firewalls"
            referencedColumns: ["id"]
          },
        ]
      }
      analyzer_config_changes: {
        Row: {
          action: string
          category: string | null
          cfgattr: string | null
          cfgobj: string | null
          cfgpath: string
          changed_at: string
          client_id: string
          created_at: string
          firewall_id: string
          id: string
          msg: string | null
          severity: string | null
          snapshot_id: string | null
          user_name: string
        }
        Insert: {
          action?: string
          category?: string | null
          cfgattr?: string | null
          cfgobj?: string | null
          cfgpath?: string
          changed_at: string
          client_id: string
          created_at?: string
          firewall_id: string
          id?: string
          msg?: string | null
          severity?: string | null
          snapshot_id?: string | null
          user_name: string
        }
        Update: {
          action?: string
          category?: string | null
          cfgattr?: string | null
          cfgobj?: string | null
          cfgpath?: string
          changed_at?: string
          client_id?: string
          created_at?: string
          firewall_id?: string
          id?: string
          msg?: string | null
          severity?: string | null
          snapshot_id?: string | null
          user_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "analyzer_config_changes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "analyzer_config_changes_firewall_id_fkey"
            columns: ["firewall_id"]
            isOneToOne: false
            referencedRelation: "firewalls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "analyzer_config_changes_snapshot_id_fkey"
            columns: ["snapshot_id"]
            isOneToOne: false
            referencedRelation: "analyzer_snapshots"
            referencedColumns: ["id"]
          },
        ]
      }
      analyzer_schedules: {
        Row: {
          created_at: string
          created_by: string | null
          firewall_id: string
          frequency: Database["public"]["Enums"]["schedule_frequency"]
          id: string
          is_active: boolean
          next_run_at: string | null
          scheduled_day_of_month: number | null
          scheduled_day_of_week: number | null
          scheduled_hour: number | null
          timezone: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          firewall_id: string
          frequency?: Database["public"]["Enums"]["schedule_frequency"]
          id?: string
          is_active?: boolean
          next_run_at?: string | null
          scheduled_day_of_month?: number | null
          scheduled_day_of_week?: number | null
          scheduled_hour?: number | null
          timezone?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          firewall_id?: string
          frequency?: Database["public"]["Enums"]["schedule_frequency"]
          id?: string
          is_active?: boolean
          next_run_at?: string | null
          scheduled_day_of_month?: number | null
          scheduled_day_of_week?: number | null
          scheduled_hour?: number | null
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "analyzer_schedules_firewall_id_fkey"
            columns: ["firewall_id"]
            isOneToOne: true
            referencedRelation: "firewalls"
            referencedColumns: ["id"]
          },
        ]
      }
      analyzer_snapshots: {
        Row: {
          agent_task_id: string | null
          client_id: string
          created_at: string
          firewall_id: string
          id: string
          insights: Json | null
          metrics: Json | null
          period_end: string | null
          period_start: string | null
          score: number | null
          status: string
          summary: Json | null
        }
        Insert: {
          agent_task_id?: string | null
          client_id: string
          created_at?: string
          firewall_id: string
          id?: string
          insights?: Json | null
          metrics?: Json | null
          period_end?: string | null
          period_start?: string | null
          score?: number | null
          status?: string
          summary?: Json | null
        }
        Update: {
          agent_task_id?: string | null
          client_id?: string
          created_at?: string
          firewall_id?: string
          id?: string
          insights?: Json | null
          metrics?: Json | null
          period_end?: string | null
          period_start?: string | null
          score?: number | null
          status?: string
          summary?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "analyzer_snapshots_agent_task_id_fkey"
            columns: ["agent_task_id"]
            isOneToOne: false
            referencedRelation: "agent_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "analyzer_snapshots_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "analyzer_snapshots_firewall_id_fkey"
            columns: ["firewall_id"]
            isOneToOne: false
            referencedRelation: "firewalls"
            referencedColumns: ["id"]
          },
        ]
      }
      attack_surface_schedules: {
        Row: {
          client_id: string
          created_at: string
          created_by: string | null
          frequency: Database["public"]["Enums"]["schedule_frequency"]
          id: string
          is_active: boolean | null
          next_run_at: string | null
          scheduled_day_of_month: number | null
          scheduled_day_of_week: number | null
          scheduled_hour: number | null
          timezone: string
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          created_by?: string | null
          frequency?: Database["public"]["Enums"]["schedule_frequency"]
          id?: string
          is_active?: boolean | null
          next_run_at?: string | null
          scheduled_day_of_month?: number | null
          scheduled_day_of_week?: number | null
          scheduled_hour?: number | null
          timezone?: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          created_by?: string | null
          frequency?: Database["public"]["Enums"]["schedule_frequency"]
          id?: string
          is_active?: boolean | null
          next_run_at?: string | null
          scheduled_day_of_month?: number | null
          scheduled_day_of_week?: number | null
          scheduled_hour?: number | null
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "attack_surface_schedules_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      attack_surface_snapshots: {
        Row: {
          client_id: string
          completed_at: string | null
          created_at: string
          created_by: string | null
          cve_matches: Json | null
          id: string
          results: Json | null
          score: number | null
          source_ips: Json | null
          status: string
          summary: Json | null
        }
        Insert: {
          client_id: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          cve_matches?: Json | null
          id?: string
          results?: Json | null
          score?: number | null
          source_ips?: Json | null
          status?: string
          summary?: Json | null
        }
        Update: {
          client_id?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          cve_matches?: Json | null
          id?: string
          results?: Json | null
          score?: number | null
          source_ips?: Json | null
          status?: string
          summary?: Json | null
        }
        Relationships: []
      }
      attack_surface_tasks: {
        Row: {
          assigned_agent_id: string | null
          completed_at: string | null
          created_at: string
          id: string
          ip: string
          label: string | null
          result: Json | null
          snapshot_id: string
          source: string
          started_at: string | null
          status: string
        }
        Insert: {
          assigned_agent_id?: string | null
          completed_at?: string | null
          created_at?: string
          id?: string
          ip: string
          label?: string | null
          result?: Json | null
          snapshot_id: string
          source: string
          started_at?: string | null
          status?: string
        }
        Update: {
          assigned_agent_id?: string | null
          completed_at?: string | null
          created_at?: string
          id?: string
          ip?: string
          label?: string | null
          result?: Json | null
          snapshot_id?: string
          source?: string
          started_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "attack_surface_tasks_assigned_agent_id_fkey"
            columns: ["assigned_agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attack_surface_tasks_snapshot_id_fkey"
            columns: ["snapshot_id"]
            isOneToOne: false
            referencedRelation: "attack_surface_snapshots"
            referencedColumns: ["id"]
          },
        ]
      }
      blueprint_step_templates: {
        Row: {
          category: string | null
          code: string
          created_at: string
          default_config: Json
          description: string | null
          executor: Database["public"]["Enums"]["blueprint_executor_type"]
          id: string
          is_active: boolean
          name: string
          runtime: string
          tags: string[] | null
          updated_at: string
        }
        Insert: {
          category?: string | null
          code: string
          created_at?: string
          default_config?: Json
          description?: string | null
          executor?: Database["public"]["Enums"]["blueprint_executor_type"]
          id?: string
          is_active?: boolean
          name: string
          runtime: string
          tags?: string[] | null
          updated_at?: string
        }
        Update: {
          category?: string | null
          code?: string
          created_at?: string
          default_config?: Json
          description?: string | null
          executor?: Database["public"]["Enums"]["blueprint_executor_type"]
          id?: string
          is_active?: boolean
          name?: string
          runtime?: string
          tags?: string[] | null
          updated_at?: string
        }
        Relationships: []
      }
      clients: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      compliance_rules: {
        Row: {
          api_endpoint: string | null
          business_impact: string | null
          category: string
          code: string
          created_at: string
          description: string | null
          device_type_id: string
          evaluation_logic: Json
          fail_description: string | null
          id: string
          is_active: boolean
          name: string
          not_found_description: string | null
          pass_description: string | null
          recommendation: string | null
          severity: Database["public"]["Enums"]["rule_severity"]
          technical_risk: string | null
          updated_at: string
          weight: number
        }
        Insert: {
          api_endpoint?: string | null
          business_impact?: string | null
          category: string
          code: string
          created_at?: string
          description?: string | null
          device_type_id: string
          evaluation_logic: Json
          fail_description?: string | null
          id?: string
          is_active?: boolean
          name: string
          not_found_description?: string | null
          pass_description?: string | null
          recommendation?: string | null
          severity?: Database["public"]["Enums"]["rule_severity"]
          technical_risk?: string | null
          updated_at?: string
          weight?: number
        }
        Update: {
          api_endpoint?: string | null
          business_impact?: string | null
          category?: string
          code?: string
          created_at?: string
          description?: string | null
          device_type_id?: string
          evaluation_logic?: Json
          fail_description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          not_found_description?: string | null
          pass_description?: string | null
          recommendation?: string | null
          severity?: Database["public"]["Enums"]["rule_severity"]
          technical_risk?: string | null
          updated_at?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "compliance_rules_device_type_id_fkey"
            columns: ["device_type_id"]
            isOneToOne: false
            referencedRelation: "device_types"
            referencedColumns: ["id"]
          },
        ]
      }
      cve_cache: {
        Row: {
          advisory_url: string | null
          created_at: string
          cve_id: string
          description: string | null
          id: string
          module_code: string
          products: Json | null
          published_date: string | null
          raw_data: Json | null
          score: number | null
          severity: string | null
          source_id: string
          title: string | null
          updated_at: string
        }
        Insert: {
          advisory_url?: string | null
          created_at?: string
          cve_id: string
          description?: string | null
          id?: string
          module_code: string
          products?: Json | null
          published_date?: string | null
          raw_data?: Json | null
          score?: number | null
          severity?: string | null
          source_id: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          advisory_url?: string | null
          created_at?: string
          cve_id?: string
          description?: string | null
          id?: string
          module_code?: string
          products?: Json | null
          published_date?: string | null
          raw_data?: Json | null
          score?: number | null
          severity?: string | null
          source_id?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cve_cache_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "cve_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      cve_severity_cache: {
        Row: {
          client_id: string | null
          critical: number
          high: number
          id: string
          low: number
          medium: number
          module_code: string
          top_cves: Json | null
          total_cves: number
          updated_at: string
        }
        Insert: {
          client_id?: string | null
          critical?: number
          high?: number
          id?: string
          low?: number
          medium?: number
          module_code: string
          top_cves?: Json | null
          total_cves?: number
          updated_at?: string
        }
        Update: {
          client_id?: string | null
          critical?: number
          high?: number
          id?: string
          low?: number
          medium?: number
          module_code?: string
          top_cves?: Json | null
          total_cves?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cve_severity_cache_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      cve_sources: {
        Row: {
          config: Json
          created_at: string
          id: string
          is_active: boolean
          last_sync_at: string | null
          last_sync_count: number | null
          last_sync_error: string | null
          last_sync_status: string | null
          module_code: string
          next_run_at: string | null
          source_label: string
          source_type: string
          updated_at: string
        }
        Insert: {
          config?: Json
          created_at?: string
          id?: string
          is_active?: boolean
          last_sync_at?: string | null
          last_sync_count?: number | null
          last_sync_error?: string | null
          last_sync_status?: string | null
          module_code: string
          next_run_at?: string | null
          source_label: string
          source_type: string
          updated_at?: string
        }
        Update: {
          config?: Json
          created_at?: string
          id?: string
          is_active?: boolean
          last_sync_at?: string | null
          last_sync_count?: number | null
          last_sync_error?: string | null
          last_sync_status?: string | null
          module_code?: string
          next_run_at?: string | null
          source_label?: string
          source_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      cve_sync_history: {
        Row: {
          completed_at: string | null
          created_at: string
          cve_count: number | null
          duration_ms: number | null
          error_message: string | null
          id: string
          source_id: string
          started_at: string
          status: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          cve_count?: number | null
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          source_id: string
          started_at?: string
          status: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          cve_count?: number | null
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          source_id?: string
          started_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "cve_sync_history_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "cve_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      dehashed_cache: {
        Row: {
          client_id: string
          created_at: string
          databases: Json
          domain: string
          entries: Json
          id: string
          queried_at: string
          total_entries: number
        }
        Insert: {
          client_id: string
          created_at?: string
          databases?: Json
          domain: string
          entries?: Json
          id?: string
          queried_at?: string
          total_entries?: number
        }
        Update: {
          client_id?: string
          created_at?: string
          databases?: Json
          domain?: string
          entries?: Json
          id?: string
          queried_at?: string
          total_entries?: number
        }
        Relationships: [
          {
            foreignKeyName: "dehashed_cache_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      device_blueprints: {
        Row: {
          collection_steps: Json
          created_at: string
          description: string | null
          device_type_id: string
          executor_type: Database["public"]["Enums"]["blueprint_executor_type"]
          id: string
          is_active: boolean
          name: string
          updated_at: string
          version: string
        }
        Insert: {
          collection_steps?: Json
          created_at?: string
          description?: string | null
          device_type_id: string
          executor_type?: Database["public"]["Enums"]["blueprint_executor_type"]
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
          version?: string
        }
        Update: {
          collection_steps?: Json
          created_at?: string
          description?: string | null
          device_type_id?: string
          executor_type?: Database["public"]["Enums"]["blueprint_executor_type"]
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "device_blueprints_device_type_id_fkey"
            columns: ["device_type_id"]
            isOneToOne: false
            referencedRelation: "device_types"
            referencedColumns: ["id"]
          },
        ]
      }
      device_type_api_docs: {
        Row: {
          content: Json
          created_at: string
          created_by: string | null
          device_type_id: string
          doc_type: string
          id: string
          notes: string | null
          title: string
          updated_at: string
          version: string
        }
        Insert: {
          content?: Json
          created_at?: string
          created_by?: string | null
          device_type_id: string
          doc_type?: string
          id?: string
          notes?: string | null
          title: string
          updated_at?: string
          version: string
        }
        Update: {
          content?: Json
          created_at?: string
          created_by?: string | null
          device_type_id?: string
          doc_type?: string
          id?: string
          notes?: string | null
          title?: string
          updated_at?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "device_type_api_docs_device_type_id_fkey"
            columns: ["device_type_id"]
            isOneToOne: false
            referencedRelation: "device_types"
            referencedColumns: ["id"]
          },
        ]
      }
      device_types: {
        Row: {
          category: Database["public"]["Enums"]["device_category"]
          code: string
          created_at: string
          icon: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
          vendor: string
        }
        Insert: {
          category?: Database["public"]["Enums"]["device_category"]
          code: string
          created_at?: string
          icon?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
          vendor: string
        }
        Update: {
          category?: Database["public"]["Enums"]["device_category"]
          code?: string
          created_at?: string
          icon?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
          vendor?: string
        }
        Relationships: []
      }
      evidence_parses: {
        Row: {
          created_at: string
          device_type_id: string
          display_label: string
          display_order: number
          format_options: Json | null
          id: string
          is_active: boolean
          is_hidden: boolean
          parse_type: Database["public"]["Enums"]["parse_type"]
          source_field: string
          updated_at: string
          value_transformations: Json | null
        }
        Insert: {
          created_at?: string
          device_type_id: string
          display_label: string
          display_order?: number
          format_options?: Json | null
          id?: string
          is_active?: boolean
          is_hidden?: boolean
          parse_type?: Database["public"]["Enums"]["parse_type"]
          source_field: string
          updated_at?: string
          value_transformations?: Json | null
        }
        Update: {
          created_at?: string
          device_type_id?: string
          display_label?: string
          display_order?: number
          format_options?: Json | null
          id?: string
          is_active?: boolean
          is_hidden?: boolean
          parse_type?: Database["public"]["Enums"]["parse_type"]
          source_field?: string
          updated_at?: string
          value_transformations?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "evidence_parses_device_type_id_fkey"
            columns: ["device_type_id"]
            isOneToOne: false
            referencedRelation: "device_types"
            referencedColumns: ["id"]
          },
        ]
      }
      external_domain_analysis_history: {
        Row: {
          analyzed_by: string | null
          completed_at: string | null
          created_at: string
          domain_id: string
          execution_time_ms: number | null
          id: string
          report_data: Json | null
          score: number | null
          source: string
          started_at: string | null
          status: string
        }
        Insert: {
          analyzed_by?: string | null
          completed_at?: string | null
          created_at?: string
          domain_id: string
          execution_time_ms?: number | null
          id?: string
          report_data?: Json | null
          score?: number | null
          source?: string
          started_at?: string | null
          status?: string
        }
        Update: {
          analyzed_by?: string | null
          completed_at?: string | null
          created_at?: string
          domain_id?: string
          execution_time_ms?: number | null
          id?: string
          report_data?: Json | null
          score?: number | null
          source?: string
          started_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "external_domain_analysis_history_domain_id_fkey"
            columns: ["domain_id"]
            isOneToOne: false
            referencedRelation: "external_domains"
            referencedColumns: ["id"]
          },
        ]
      }
      external_domain_schedules: {
        Row: {
          created_at: string
          created_by: string | null
          domain_id: string
          frequency: Database["public"]["Enums"]["schedule_frequency"]
          id: string
          is_active: boolean
          next_run_at: string | null
          scheduled_day_of_month: number | null
          scheduled_day_of_week: number | null
          scheduled_hour: number | null
          timezone: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          domain_id: string
          frequency: Database["public"]["Enums"]["schedule_frequency"]
          id?: string
          is_active?: boolean
          next_run_at?: string | null
          scheduled_day_of_month?: number | null
          scheduled_day_of_week?: number | null
          scheduled_hour?: number | null
          timezone?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          domain_id?: string
          frequency?: Database["public"]["Enums"]["schedule_frequency"]
          id?: string
          is_active?: boolean
          next_run_at?: string | null
          scheduled_day_of_month?: number | null
          scheduled_day_of_week?: number | null
          scheduled_hour?: number | null
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "external_domain_schedules_domain_id_fkey"
            columns: ["domain_id"]
            isOneToOne: true
            referencedRelation: "external_domains"
            referencedColumns: ["id"]
          },
        ]
      }
      external_domains: {
        Row: {
          agent_id: string | null
          client_id: string
          created_at: string
          created_by: string | null
          description: string | null
          domain: string
          id: string
          last_scan_at: string | null
          last_score: number | null
          name: string
          status: string
          updated_at: string
          whois_checked_at: string | null
          whois_created_at: string | null
          whois_expires_at: string | null
          whois_registrar: string | null
        }
        Insert: {
          agent_id?: string | null
          client_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          domain: string
          id?: string
          last_scan_at?: string | null
          last_score?: number | null
          name: string
          status?: string
          updated_at?: string
          whois_checked_at?: string | null
          whois_created_at?: string | null
          whois_expires_at?: string | null
          whois_registrar?: string | null
        }
        Update: {
          agent_id?: string | null
          client_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          domain?: string
          id?: string
          last_scan_at?: string | null
          last_score?: number | null
          name?: string
          status?: string
          updated_at?: string
          whois_checked_at?: string | null
          whois_created_at?: string | null
          whois_expires_at?: string | null
          whois_registrar?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "external_domains_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_domains_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      firewalls: {
        Row: {
          agent_id: string | null
          api_key: string
          auth_password: string | null
          auth_username: string | null
          client_id: string
          cloud_public_ip: string | null
          created_at: string
          created_by: string | null
          description: string | null
          device_type_id: string | null
          fortigate_url: string
          geo_latitude: number | null
          geo_longitude: number | null
          id: string
          last_analysis_at: string | null
          last_score: number | null
          name: string
          serial_number: string | null
          updated_at: string
        }
        Insert: {
          agent_id?: string | null
          api_key: string
          auth_password?: string | null
          auth_username?: string | null
          client_id: string
          cloud_public_ip?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          device_type_id?: string | null
          fortigate_url: string
          geo_latitude?: number | null
          geo_longitude?: number | null
          id?: string
          last_analysis_at?: string | null
          last_score?: number | null
          name: string
          serial_number?: string | null
          updated_at?: string
        }
        Update: {
          agent_id?: string | null
          api_key?: string
          auth_password?: string | null
          auth_username?: string | null
          client_id?: string
          cloud_public_ip?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          device_type_id?: string | null
          fortigate_url?: string
          geo_latitude?: number | null
          geo_longitude?: number | null
          id?: string
          last_analysis_at?: string | null
          last_score?: number | null
          name?: string
          serial_number?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "firewalls_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "firewalls_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "firewalls_device_type_id_fkey"
            columns: ["device_type_id"]
            isOneToOne: false
            referencedRelation: "device_types"
            referencedColumns: ["id"]
          },
        ]
      }
      m365_analyzer_schedules: {
        Row: {
          created_at: string
          created_by: string | null
          frequency: Database["public"]["Enums"]["schedule_frequency"]
          id: string
          is_active: boolean
          next_run_at: string | null
          scheduled_day_of_month: number | null
          scheduled_day_of_week: number | null
          scheduled_hour: number | null
          tenant_record_id: string
          timezone: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          frequency?: Database["public"]["Enums"]["schedule_frequency"]
          id?: string
          is_active?: boolean
          next_run_at?: string | null
          scheduled_day_of_month?: number | null
          scheduled_day_of_week?: number | null
          scheduled_hour?: number | null
          tenant_record_id: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          frequency?: Database["public"]["Enums"]["schedule_frequency"]
          id?: string
          is_active?: boolean
          next_run_at?: string | null
          scheduled_day_of_month?: number | null
          scheduled_day_of_week?: number | null
          scheduled_hour?: number | null
          tenant_record_id?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "m365_analyzer_schedules_tenant_record_id_fkey"
            columns: ["tenant_record_id"]
            isOneToOne: true
            referencedRelation: "m365_tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      m365_analyzer_snapshots: {
        Row: {
          agent_task_id: string | null
          client_id: string
          created_at: string
          id: string
          insights: Json | null
          metrics: Json | null
          period_end: string | null
          period_start: string | null
          score: number | null
          status: string
          summary: Json | null
          tenant_record_id: string
        }
        Insert: {
          agent_task_id?: string | null
          client_id: string
          created_at?: string
          id?: string
          insights?: Json | null
          metrics?: Json | null
          period_end?: string | null
          period_start?: string | null
          score?: number | null
          status?: string
          summary?: Json | null
          tenant_record_id: string
        }
        Update: {
          agent_task_id?: string | null
          client_id?: string
          created_at?: string
          id?: string
          insights?: Json | null
          metrics?: Json | null
          period_end?: string | null
          period_start?: string | null
          score?: number | null
          status?: string
          summary?: Json | null
          tenant_record_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "m365_analyzer_snapshots_agent_task_id_fkey"
            columns: ["agent_task_id"]
            isOneToOne: false
            referencedRelation: "agent_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "m365_analyzer_snapshots_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "m365_analyzer_snapshots_tenant_record_id_fkey"
            columns: ["tenant_record_id"]
            isOneToOne: false
            referencedRelation: "m365_tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      m365_app_credentials: {
        Row: {
          app_object_id: string | null
          auth_type: string
          azure_app_id: string
          certificate_thumbprint: string | null
          client_secret_encrypted: string | null
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          is_active: boolean
          sp_object_id: string | null
          tenant_record_id: string
          updated_at: string
        }
        Insert: {
          app_object_id?: string | null
          auth_type?: string
          azure_app_id: string
          certificate_thumbprint?: string | null
          client_secret_encrypted?: string | null
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          sp_object_id?: string | null
          tenant_record_id: string
          updated_at?: string
        }
        Update: {
          app_object_id?: string | null
          auth_type?: string
          azure_app_id?: string
          certificate_thumbprint?: string | null
          client_secret_encrypted?: string | null
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          sp_object_id?: string | null
          tenant_record_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "m365_app_credentials_tenant_record_id_fkey"
            columns: ["tenant_record_id"]
            isOneToOne: true
            referencedRelation: "m365_tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      m365_audit_logs: {
        Row: {
          action: string
          action_details: Json | null
          client_id: string | null
          created_at: string
          id: string
          ip_address: string | null
          tenant_record_id: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          action_details?: Json | null
          client_id?: string | null
          created_at?: string
          id?: string
          ip_address?: string | null
          tenant_record_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          action_details?: Json | null
          client_id?: string | null
          created_at?: string
          id?: string
          ip_address?: string | null
          tenant_record_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "m365_audit_logs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "m365_audit_logs_tenant_record_id_fkey"
            columns: ["tenant_record_id"]
            isOneToOne: false
            referencedRelation: "m365_tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      m365_compliance_schedules: {
        Row: {
          created_at: string
          created_by: string | null
          frequency: Database["public"]["Enums"]["schedule_frequency"]
          id: string
          is_active: boolean
          next_run_at: string | null
          scheduled_day_of_month: number | null
          scheduled_day_of_week: number | null
          scheduled_hour: number | null
          tenant_record_id: string
          timezone: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          frequency?: Database["public"]["Enums"]["schedule_frequency"]
          id?: string
          is_active?: boolean
          next_run_at?: string | null
          scheduled_day_of_month?: number | null
          scheduled_day_of_week?: number | null
          scheduled_hour?: number | null
          tenant_record_id: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          frequency?: Database["public"]["Enums"]["schedule_frequency"]
          id?: string
          is_active?: boolean
          next_run_at?: string | null
          scheduled_day_of_month?: number | null
          scheduled_day_of_week?: number | null
          scheduled_hour?: number | null
          tenant_record_id?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "m365_compliance_schedules_tenant_record_id_fkey"
            columns: ["tenant_record_id"]
            isOneToOne: true
            referencedRelation: "m365_tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      m365_dashboard_snapshots: {
        Row: {
          client_id: string | null
          created_at: string | null
          dashboard_type: string
          data: Json
          id: string
          period_end: string | null
          period_start: string | null
          tenant_record_id: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string | null
          dashboard_type: string
          data?: Json
          id?: string
          period_end?: string | null
          period_start?: string | null
          tenant_record_id: string
        }
        Update: {
          client_id?: string | null
          created_at?: string | null
          dashboard_type?: string
          data?: Json
          id?: string
          period_end?: string | null
          period_start?: string | null
          tenant_record_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "m365_dashboard_snapshots_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "m365_dashboard_snapshots_tenant_record_id_fkey"
            columns: ["tenant_record_id"]
            isOneToOne: false
            referencedRelation: "m365_tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      m365_external_movement_alerts: {
        Row: {
          affected_domains: string[] | null
          alert_type: string
          client_id: string
          created_at: string
          description: string | null
          evidence: Json | null
          id: string
          is_anomalous: boolean
          is_new: boolean
          pct_increase: number | null
          risk_score: number
          severity: string
          snapshot_id: string | null
          tenant_record_id: string
          title: string
          user_id: string
          z_score: number | null
        }
        Insert: {
          affected_domains?: string[] | null
          alert_type: string
          client_id: string
          created_at?: string
          description?: string | null
          evidence?: Json | null
          id?: string
          is_anomalous?: boolean
          is_new?: boolean
          pct_increase?: number | null
          risk_score?: number
          severity?: string
          snapshot_id?: string | null
          tenant_record_id: string
          title: string
          user_id: string
          z_score?: number | null
        }
        Update: {
          affected_domains?: string[] | null
          alert_type?: string
          client_id?: string
          created_at?: string
          description?: string | null
          evidence?: Json | null
          id?: string
          is_anomalous?: boolean
          is_new?: boolean
          pct_increase?: number | null
          risk_score?: number
          severity?: string
          snapshot_id?: string | null
          tenant_record_id?: string
          title?: string
          user_id?: string
          z_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "m365_external_movement_alerts_snapshot_id_fkey"
            columns: ["snapshot_id"]
            isOneToOne: false
            referencedRelation: "m365_analyzer_snapshots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "m365_external_movement_alerts_tenant_record_id_fkey"
            columns: ["tenant_record_id"]
            isOneToOne: false
            referencedRelation: "m365_tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      m365_global_config: {
        Row: {
          app_id: string
          app_object_id: string | null
          client_secret_encrypted: string
          created_at: string
          created_by: string | null
          home_tenant_id: string | null
          id: string
          last_validated_at: string | null
          updated_at: string
          updated_by: string | null
          validated_permissions: Json | null
          validation_tenant_id: string | null
        }
        Insert: {
          app_id: string
          app_object_id?: string | null
          client_secret_encrypted: string
          created_at?: string
          created_by?: string | null
          home_tenant_id?: string | null
          id?: string
          last_validated_at?: string | null
          updated_at?: string
          updated_by?: string | null
          validated_permissions?: Json | null
          validation_tenant_id?: string | null
        }
        Update: {
          app_id?: string
          app_object_id?: string | null
          client_secret_encrypted?: string
          created_at?: string
          created_by?: string | null
          home_tenant_id?: string | null
          id?: string
          last_validated_at?: string | null
          updated_at?: string
          updated_by?: string | null
          validated_permissions?: Json | null
          validation_tenant_id?: string | null
        }
        Relationships: []
      }
      m365_posture_history: {
        Row: {
          agent_insights: Json | null
          agent_status: string | null
          agent_task_id: string | null
          analyzed_by: string | null
          category_breakdown: Json | null
          classification: string | null
          client_id: string
          completed_at: string | null
          created_at: string | null
          environment_metrics: Json | null
          errors: Json | null
          id: string
          insights: Json | null
          score: number | null
          started_at: string | null
          status: string
          summary: Json | null
          tenant_record_id: string
        }
        Insert: {
          agent_insights?: Json | null
          agent_status?: string | null
          agent_task_id?: string | null
          analyzed_by?: string | null
          category_breakdown?: Json | null
          classification?: string | null
          client_id: string
          completed_at?: string | null
          created_at?: string | null
          environment_metrics?: Json | null
          errors?: Json | null
          id?: string
          insights?: Json | null
          score?: number | null
          started_at?: string | null
          status?: string
          summary?: Json | null
          tenant_record_id: string
        }
        Update: {
          agent_insights?: Json | null
          agent_status?: string | null
          agent_task_id?: string | null
          analyzed_by?: string | null
          category_breakdown?: Json | null
          classification?: string | null
          client_id?: string
          completed_at?: string | null
          created_at?: string | null
          environment_metrics?: Json | null
          errors?: Json | null
          id?: string
          insights?: Json | null
          score?: number | null
          started_at?: string | null
          status?: string
          summary?: Json | null
          tenant_record_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "m365_posture_history_agent_task_id_fkey"
            columns: ["agent_task_id"]
            isOneToOne: false
            referencedRelation: "agent_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "m365_posture_history_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "m365_posture_history_tenant_record_id_fkey"
            columns: ["tenant_record_id"]
            isOneToOne: false
            referencedRelation: "m365_tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      m365_required_permissions: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_required: boolean
          permission_name: string
          permission_type: string
          submodule: Database["public"]["Enums"]["m365_submodule"]
          test_url: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_required?: boolean
          permission_name: string
          permission_type?: string
          submodule: Database["public"]["Enums"]["m365_submodule"]
          test_url?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_required?: boolean
          permission_name?: string
          permission_type?: string
          submodule?: Database["public"]["Enums"]["m365_submodule"]
          test_url?: string | null
        }
        Relationships: []
      }
      m365_tenant_agents: {
        Row: {
          agent_id: string
          created_at: string | null
          enabled: boolean | null
          id: string
          tenant_record_id: string
          updated_at: string | null
        }
        Insert: {
          agent_id: string
          created_at?: string | null
          enabled?: boolean | null
          id?: string
          tenant_record_id: string
          updated_at?: string | null
        }
        Update: {
          agent_id?: string
          created_at?: string | null
          enabled?: boolean | null
          id?: string
          tenant_record_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "m365_tenant_agents_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "m365_tenant_agents_tenant_record_id_fkey"
            columns: ["tenant_record_id"]
            isOneToOne: false
            referencedRelation: "m365_tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      m365_tenant_licenses: {
        Row: {
          capability_status: string
          client_id: string
          collected_at: string
          consumed_units: number
          created_at: string
          display_name: string
          expires_at: string | null
          id: string
          sku_id: string
          sku_part_number: string
          suspended_units: number
          tenant_record_id: string
          total_units: number
          warning_units: number
        }
        Insert: {
          capability_status?: string
          client_id: string
          collected_at?: string
          consumed_units?: number
          created_at?: string
          display_name: string
          expires_at?: string | null
          id?: string
          sku_id: string
          sku_part_number: string
          suspended_units?: number
          tenant_record_id: string
          total_units?: number
          warning_units?: number
        }
        Update: {
          capability_status?: string
          client_id?: string
          collected_at?: string
          consumed_units?: number
          created_at?: string
          display_name?: string
          expires_at?: string | null
          id?: string
          sku_id?: string
          sku_part_number?: string
          suspended_units?: number
          tenant_record_id?: string
          total_units?: number
          warning_units?: number
        }
        Relationships: [
          {
            foreignKeyName: "m365_tenant_licenses_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "m365_tenant_licenses_tenant_record_id_fkey"
            columns: ["tenant_record_id"]
            isOneToOne: false
            referencedRelation: "m365_tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      m365_tenant_permissions: {
        Row: {
          created_at: string
          error_reason: string | null
          granted_at: string | null
          granted_by: string | null
          id: string
          permission_name: string
          permission_type: string
          status: Database["public"]["Enums"]["permission_status"]
          tenant_record_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          error_reason?: string | null
          granted_at?: string | null
          granted_by?: string | null
          id?: string
          permission_name: string
          permission_type?: string
          status?: Database["public"]["Enums"]["permission_status"]
          tenant_record_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          error_reason?: string | null
          granted_at?: string | null
          granted_by?: string | null
          id?: string
          permission_name?: string
          permission_type?: string
          status?: Database["public"]["Enums"]["permission_status"]
          tenant_record_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "m365_tenant_permissions_tenant_record_id_fkey"
            columns: ["tenant_record_id"]
            isOneToOne: false
            referencedRelation: "m365_tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      m365_tenant_submodules: {
        Row: {
          created_at: string
          id: string
          is_enabled: boolean
          last_sync_at: string | null
          submodule: Database["public"]["Enums"]["m365_submodule"]
          sync_status: string | null
          tenant_record_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_enabled?: boolean
          last_sync_at?: string | null
          submodule: Database["public"]["Enums"]["m365_submodule"]
          sync_status?: string | null
          tenant_record_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_enabled?: boolean
          last_sync_at?: string | null
          submodule?: Database["public"]["Enums"]["m365_submodule"]
          sync_status?: string | null
          tenant_record_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "m365_tenant_submodules_tenant_record_id_fkey"
            columns: ["tenant_record_id"]
            isOneToOne: false
            referencedRelation: "m365_tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      m365_tenants: {
        Row: {
          client_id: string
          collaboration_dashboard_cache: Json | null
          collaboration_dashboard_cached_at: string | null
          connection_status: Database["public"]["Enums"]["tenant_connection_status"]
          created_at: string
          created_by: string | null
          display_name: string | null
          entra_dashboard_cache: Json | null
          entra_dashboard_cached_at: string | null
          exchange_dashboard_cache: Json | null
          exchange_dashboard_cached_at: string | null
          exchange_rbac_assigned: boolean | null
          exchange_sp_registered: boolean | null
          id: string
          last_validated_at: string | null
          spo_domain: string | null
          tenant_domain: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          client_id: string
          collaboration_dashboard_cache?: Json | null
          collaboration_dashboard_cached_at?: string | null
          connection_status?: Database["public"]["Enums"]["tenant_connection_status"]
          created_at?: string
          created_by?: string | null
          display_name?: string | null
          entra_dashboard_cache?: Json | null
          entra_dashboard_cached_at?: string | null
          exchange_dashboard_cache?: Json | null
          exchange_dashboard_cached_at?: string | null
          exchange_rbac_assigned?: boolean | null
          exchange_sp_registered?: boolean | null
          id?: string
          last_validated_at?: string | null
          spo_domain?: string | null
          tenant_domain?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          collaboration_dashboard_cache?: Json | null
          collaboration_dashboard_cached_at?: string | null
          connection_status?: Database["public"]["Enums"]["tenant_connection_status"]
          created_at?: string
          created_by?: string | null
          display_name?: string | null
          entra_dashboard_cache?: Json | null
          entra_dashboard_cached_at?: string | null
          exchange_dashboard_cache?: Json | null
          exchange_dashboard_cached_at?: string | null
          exchange_rbac_assigned?: boolean | null
          exchange_sp_registered?: boolean | null
          id?: string
          last_validated_at?: string | null
          spo_domain?: string | null
          tenant_domain?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "m365_tenants_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      m365_threat_dismissals: {
        Row: {
          created_at: string
          dismissed_by: string
          id: string
          label: string
          reason: string | null
          tenant_record_id: string
          type: string
        }
        Insert: {
          created_at?: string
          dismissed_by: string
          id?: string
          label: string
          reason?: string | null
          tenant_record_id: string
          type: string
        }
        Update: {
          created_at?: string
          dismissed_by?: string
          id?: string
          label?: string
          reason?: string | null
          tenant_record_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "m365_threat_dismissals_tenant_record_id_fkey"
            columns: ["tenant_record_id"]
            isOneToOne: false
            referencedRelation: "m365_tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      m365_tokens: {
        Row: {
          access_token_encrypted: string | null
          created_at: string
          expires_at: string | null
          id: string
          refresh_token_encrypted: string | null
          scope: string | null
          tenant_record_id: string
          token_type: string | null
          updated_at: string
        }
        Insert: {
          access_token_encrypted?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          refresh_token_encrypted?: string | null
          scope?: string | null
          tenant_record_id: string
          token_type?: string | null
          updated_at?: string
        }
        Update: {
          access_token_encrypted?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          refresh_token_encrypted?: string | null
          scope?: string | null
          tenant_record_id?: string
          token_type?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "m365_tokens_tenant_record_id_fkey"
            columns: ["tenant_record_id"]
            isOneToOne: false
            referencedRelation: "m365_tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      m365_user_baselines: {
        Row: {
          avg_received_daily: number | null
          avg_recipients_per_msg: number | null
          avg_sent_daily: number | null
          baseline_date: string
          id: string
          sample_days: number | null
          tenant_record_id: string
          typical_send_hours: Json | null
          updated_at: string
          user_principal_name: string
        }
        Insert: {
          avg_received_daily?: number | null
          avg_recipients_per_msg?: number | null
          avg_sent_daily?: number | null
          baseline_date?: string
          id?: string
          sample_days?: number | null
          tenant_record_id: string
          typical_send_hours?: Json | null
          updated_at?: string
          user_principal_name: string
        }
        Update: {
          avg_received_daily?: number | null
          avg_recipients_per_msg?: number | null
          avg_sent_daily?: number | null
          baseline_date?: string
          id?: string
          sample_days?: number | null
          tenant_record_id?: string
          typical_send_hours?: Json | null
          updated_at?: string
          user_principal_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "m365_user_baselines_tenant_record_id_fkey"
            columns: ["tenant_record_id"]
            isOneToOne: false
            referencedRelation: "m365_tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      m365_user_external_daily_stats: {
        Row: {
          client_id: string
          created_at: string
          date: string
          domains_list: string[] | null
          hour_distribution: Json | null
          id: string
          mean_hour: number | null
          std_hour: number | null
          tenant_record_id: string
          total_external_emails: number
          total_external_mb: number
          unique_domains: number
          user_id: string
        }
        Insert: {
          client_id: string
          created_at?: string
          date: string
          domains_list?: string[] | null
          hour_distribution?: Json | null
          id?: string
          mean_hour?: number | null
          std_hour?: number | null
          tenant_record_id: string
          total_external_emails?: number
          total_external_mb?: number
          unique_domains?: number
          user_id: string
        }
        Update: {
          client_id?: string
          created_at?: string
          date?: string
          domains_list?: string[] | null
          hour_distribution?: Json | null
          id?: string
          mean_hour?: number | null
          std_hour?: number | null
          tenant_record_id?: string
          total_external_emails?: number
          total_external_mb?: number
          unique_domains?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "m365_user_external_daily_stats_tenant_record_id_fkey"
            columns: ["tenant_record_id"]
            isOneToOne: false
            referencedRelation: "m365_tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      m365_user_external_domain_history: {
        Row: {
          client_id: string
          created_at: string
          domain: string
          first_seen: string
          id: string
          last_seen: string
          tenant_record_id: string
          total_emails: number
          total_mb: number
          user_id: string
        }
        Insert: {
          client_id: string
          created_at?: string
          domain: string
          first_seen?: string
          id?: string
          last_seen?: string
          tenant_record_id: string
          total_emails?: number
          total_mb?: number
          user_id: string
        }
        Update: {
          client_id?: string
          created_at?: string
          domain?: string
          first_seen?: string
          id?: string
          last_seen?: string
          tenant_record_id?: string
          total_emails?: number
          total_mb?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "m365_user_external_domain_history_tenant_record_id_fkey"
            columns: ["tenant_record_id"]
            isOneToOne: false
            referencedRelation: "m365_tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      modules: {
        Row: {
          code: string
          color: string | null
          created_at: string
          description: string | null
          icon: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          code: string
          color?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          code?: string
          color?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      notification_preferences: {
        Row: {
          attack_surface: boolean
          created_at: string | null
          external_domain_analysis: boolean
          firewall_analysis: boolean
          id: string
          m365_analyzer_critical: boolean
          m365_general: boolean
          updated_at: string | null
          user_id: string
        }
        Insert: {
          attack_surface?: boolean
          created_at?: string | null
          external_domain_analysis?: boolean
          firewall_analysis?: boolean
          id?: string
          m365_analyzer_critical?: boolean
          m365_general?: boolean
          updated_at?: string | null
          user_id: string
        }
        Update: {
          attack_surface?: boolean
          created_at?: string | null
          external_domain_analysis?: boolean
          firewall_analysis?: boolean
          id?: string
          m365_analyzer_critical?: boolean
          m365_general?: boolean
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      preview_sessions: {
        Row: {
          admin_id: string
          created_at: string
          ended_at: string | null
          id: string
          ip_address: string | null
          mode: string
          reason: string | null
          started_at: string
          target_user_id: string
          target_workspace_id: string | null
          user_agent: string | null
        }
        Insert: {
          admin_id: string
          created_at?: string
          ended_at?: string | null
          id?: string
          ip_address?: string | null
          mode?: string
          reason?: string | null
          started_at?: string
          target_user_id: string
          target_workspace_id?: string | null
          user_agent?: string | null
        }
        Update: {
          admin_id?: string
          created_at?: string
          ended_at?: string | null
          id?: string
          ip_address?: string | null
          mode?: string
          reason?: string | null
          started_at?: string
          target_user_id?: string
          target_workspace_id?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "preview_sessions_target_workspace_id_fkey"
            columns: ["target_workspace_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          timezone: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      rate_limits: {
        Row: {
          created_at: string
          endpoint: string
          id: string
          ip_address: string | null
          key: string
        }
        Insert: {
          created_at?: string
          endpoint: string
          id?: string
          ip_address?: string | null
          key: string
        }
        Update: {
          created_at?: string
          endpoint?: string
          id?: string
          ip_address?: string | null
          key?: string
        }
        Relationships: []
      }
      rule_categories: {
        Row: {
          color: string
          created_at: string
          device_type_id: string
          display_name: string | null
          display_order: number
          icon: string
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          color?: string
          created_at?: string
          device_type_id: string
          display_name?: string | null
          display_order?: number
          icon?: string
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          device_type_id?: string
          display_name?: string | null
          display_order?: number
          icon?: string
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rule_categories_device_type_id_fkey"
            columns: ["device_type_id"]
            isOneToOne: false
            referencedRelation: "device_types"
            referencedColumns: ["id"]
          },
        ]
      }
      rule_correction_guides: {
        Row: {
          created_at: string
          difficulty: string | null
          friendly_title: string | null
          how_to_fix: Json | null
          id: string
          impacts: Json | null
          provider_examples: Json | null
          rule_id: string
          time_estimate: string | null
          updated_at: string
          what_is: string | null
          why_matters: string | null
        }
        Insert: {
          created_at?: string
          difficulty?: string | null
          friendly_title?: string | null
          how_to_fix?: Json | null
          id?: string
          impacts?: Json | null
          provider_examples?: Json | null
          rule_id: string
          time_estimate?: string | null
          updated_at?: string
          what_is?: string | null
          why_matters?: string | null
        }
        Update: {
          created_at?: string
          difficulty?: string | null
          friendly_title?: string | null
          how_to_fix?: Json | null
          id?: string
          impacts?: Json | null
          provider_examples?: Json | null
          rule_id?: string
          time_estimate?: string | null
          updated_at?: string
          what_is?: string | null
          why_matters?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rule_correction_guides_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: true
            referencedRelation: "compliance_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      source_key_endpoints: {
        Row: {
          created_at: string | null
          device_type_id: string
          endpoint_label: string
          endpoint_url: string | null
          id: string
          is_active: boolean | null
          source_key: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          device_type_id: string
          endpoint_label: string
          endpoint_url?: string | null
          id?: string
          is_active?: boolean | null
          source_key: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          device_type_id?: string
          endpoint_label?: string
          endpoint_url?: string | null
          id?: string
          is_active?: boolean | null
          source_key?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "source_key_endpoints_device_type_id_fkey"
            columns: ["device_type_id"]
            isOneToOne: false
            referencedRelation: "device_types"
            referencedColumns: ["id"]
          },
        ]
      }
      system_alerts: {
        Row: {
          alert_type: string
          created_at: string
          dismissed_by: string[] | null
          expires_at: string | null
          id: string
          is_active: boolean
          message: string
          metadata: Json | null
          severity: string
          target_role: Database["public"]["Enums"]["app_role"] | null
          title: string
          updated_at: string
        }
        Insert: {
          alert_type: string
          created_at?: string
          dismissed_by?: string[] | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          message: string
          metadata?: Json | null
          severity?: string
          target_role?: Database["public"]["Enums"]["app_role"] | null
          title: string
          updated_at?: string
        }
        Update: {
          alert_type?: string
          created_at?: string
          dismissed_by?: string[] | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          message?: string
          metadata?: Json | null
          severity?: string
          target_role?: Database["public"]["Enums"]["app_role"] | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      system_settings: {
        Row: {
          description: string | null
          id: string
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          description?: string | null
          id?: string
          key: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          description?: string | null
          id?: string
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      task_step_results: {
        Row: {
          created_at: string | null
          data: Json | null
          duration_ms: number | null
          error_message: string | null
          id: string
          status: string
          step_id: string
          task_id: string
        }
        Insert: {
          created_at?: string | null
          data?: Json | null
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          status: string
          step_id: string
          task_id: string
        }
        Update: {
          created_at?: string | null
          data?: Json | null
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          status?: string
          step_id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_step_results_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "agent_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      user_clients: {
        Row: {
          client_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_clients_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      user_module_permissions: {
        Row: {
          created_at: string
          id: string
          module_name: string
          permission: Database["public"]["Enums"]["module_permission"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          module_name: string
          permission?: Database["public"]["Enums"]["module_permission"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          module_name?: string
          permission?: Database["public"]["Enums"]["module_permission"]
          user_id?: string
        }
        Relationships: []
      }
      user_modules: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          module_id: string
          permission: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          module_id: string
          permission?: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          module_id?: string
          permission?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_modules_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
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
      can_manage_user: {
        Args: { _admin_id: string; _target_user_id: string }
        Returns: boolean
      }
      cleanup_old_step_results: { Args: never; Returns: number }
      cleanup_stuck_tasks: { Args: never; Returns: undefined }
      get_ext_domain_dashboard_summary: {
        Args: { p_domain_ids: string[] }
        Returns: {
          analyzed_at: string
          critical: number
          domain_id: string
          high: number
          low: number
          medium: number
          score: number
        }[]
      }
      get_fw_dashboard_summary: {
        Args: { p_firewall_ids: string[] }
        Returns: {
          analyzed_at: string
          critical: number
          firewall_id: string
          high: number
          low: number
          medium: number
          score: number
        }[]
      }
      get_insight_affected_entities: {
        Args: { p_history_id: string; p_insight_code: string }
        Returns: Json
      }
      get_module_permission: {
        Args: { _module_name: string; _user_id: string }
        Returns: Database["public"]["Enums"]["module_permission"]
      }
      get_posture_insights_lite: {
        Args: { p_tenant_record_id: string }
        Returns: Json
      }
      get_user_modules: {
        Args: { _user_id: string }
        Returns: {
          code: Database["public"]["Enums"]["scope_module"]
          description: string
          icon: string
          module_id: string
          name: string
        }[]
      }
      has_client_access: {
        Args: { _client_id: string; _user_id: string }
        Returns: boolean
      }
      has_module_access:
        | {
            Args: {
              _module_code: Database["public"]["Enums"]["scope_module"]
              _user_id: string
            }
            Returns: boolean
          }
        | { Args: { _module_code: string; _user_id: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_client_admin: { Args: { _user_id: string }; Returns: boolean }
      rpc_agent_heartbeat: { Args: { p_agent_id: string }; Returns: Json }
      rpc_get_agent_tasks: {
        Args: { p_agent_id: string; p_limit?: number }
        Returns: Json
      }
    }
    Enums: {
      agent_task_status:
        | "pending"
        | "running"
        | "completed"
        | "failed"
        | "timeout"
        | "cancelled"
      agent_task_type:
        | "fortigate_compliance"
        | "fortigate_cve"
        | "ssh_command"
        | "snmp_query"
        | "ping_check"
        | "external_domain_analysis"
        | "m365_powershell"
        | "firewall_analyzer"
        | "fortigate_analyzer"
        | "geo_query"
        | "m365_analyzer"
      app_role: "super_admin" | "workspace_admin" | "user" | "super_suporte"
      blueprint_executor_type: "agent" | "edge_function" | "hybrid"
      device_category:
        | "firewall"
        | "switch"
        | "router"
        | "wlc"
        | "server"
        | "other"
        | "scanner"
      m365_submodule:
        | "entra_id"
        | "sharepoint"
        | "exchange"
        | "defender"
        | "intune"
        | "teams"
      module_permission: "view" | "edit" | "full"
      parse_type: "text" | "boolean" | "time" | "list" | "json" | "number"
      permission_status: "granted" | "pending" | "denied" | "missing"
      rule_severity: "critical" | "high" | "medium" | "low" | "info"
      schedule_frequency: "daily" | "weekly" | "monthly" | "manual" | "hourly"
      scope_module:
        | "scope_firewall"
        | "scope_network"
        | "scope_cloud"
        | "scope_m365"
      tenant_connection_status:
        | "pending"
        | "connected"
        | "partial"
        | "failed"
        | "disconnected"
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
      agent_task_status: [
        "pending",
        "running",
        "completed",
        "failed",
        "timeout",
        "cancelled",
      ],
      agent_task_type: [
        "fortigate_compliance",
        "fortigate_cve",
        "ssh_command",
        "snmp_query",
        "ping_check",
        "external_domain_analysis",
        "m365_powershell",
        "firewall_analyzer",
        "fortigate_analyzer",
        "geo_query",
        "m365_analyzer",
      ],
      app_role: ["super_admin", "workspace_admin", "user", "super_suporte"],
      blueprint_executor_type: ["agent", "edge_function", "hybrid"],
      device_category: [
        "firewall",
        "switch",
        "router",
        "wlc",
        "server",
        "other",
        "scanner",
      ],
      m365_submodule: [
        "entra_id",
        "sharepoint",
        "exchange",
        "defender",
        "intune",
        "teams",
      ],
      module_permission: ["view", "edit", "full"],
      parse_type: ["text", "boolean", "time", "list", "json", "number"],
      permission_status: ["granted", "pending", "denied", "missing"],
      rule_severity: ["critical", "high", "medium", "low", "info"],
      schedule_frequency: ["daily", "weekly", "monthly", "manual", "hourly"],
      scope_module: [
        "scope_firewall",
        "scope_network",
        "scope_cloud",
        "scope_m365",
      ],
      tenant_connection_status: [
        "pending",
        "connected",
        "partial",
        "failed",
        "disconnected",
      ],
    },
  },
} as const
