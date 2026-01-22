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
      agents: {
        Row: {
          activation_code: string | null
          activation_code_expires_at: string | null
          client_id: string | null
          created_at: string
          created_by: string | null
          id: string
          jwt_secret: string | null
          last_seen: string | null
          name: string
          revoked: boolean
        }
        Insert: {
          activation_code?: string | null
          activation_code_expires_at?: string | null
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          jwt_secret?: string | null
          last_seen?: string | null
          name: string
          revoked?: boolean
        }
        Update: {
          activation_code?: string | null
          activation_code_expires_at?: string | null
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          jwt_secret?: string | null
          last_seen?: string | null
          name?: string
          revoked?: boolean
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
      firewalls: {
        Row: {
          api_key: string
          client_id: string
          created_at: string
          created_by: string | null
          description: string | null
          fortigate_url: string
          id: string
          last_analysis_at: string | null
          last_score: number | null
          name: string
          serial_number: string | null
          updated_at: string
        }
        Insert: {
          api_key: string
          client_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          fortigate_url: string
          id?: string
          last_analysis_at?: string | null
          last_score?: number | null
          name: string
          serial_number?: string | null
          updated_at?: string
        }
        Update: {
          api_key?: string
          client_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          fortigate_url?: string
          id?: string
          last_analysis_at?: string | null
          last_score?: number | null
          name?: string
          serial_number?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "firewalls_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      m365_app_credentials: {
        Row: {
          auth_type: string
          azure_app_id: string
          certificate_thumbprint: string | null
          client_secret_encrypted: string | null
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          is_active: boolean
          tenant_record_id: string
          updated_at: string
        }
        Insert: {
          auth_type?: string
          azure_app_id: string
          certificate_thumbprint?: string | null
          client_secret_encrypted?: string | null
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          tenant_record_id: string
          updated_at?: string
        }
        Update: {
          auth_type?: string
          azure_app_id?: string
          certificate_thumbprint?: string | null
          client_secret_encrypted?: string | null
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
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
      m365_global_config: {
        Row: {
          app_id: string
          client_secret_encrypted: string
          created_at: string
          created_by: string | null
          id: string
          last_validated_at: string | null
          updated_at: string
          updated_by: string | null
          validated_permissions: Json | null
          validation_tenant_id: string | null
        }
        Insert: {
          app_id: string
          client_secret_encrypted: string
          created_at?: string
          created_by?: string | null
          id?: string
          last_validated_at?: string | null
          updated_at?: string
          updated_by?: string | null
          validated_permissions?: Json | null
          validation_tenant_id?: string | null
        }
        Update: {
          app_id?: string
          client_secret_encrypted?: string
          created_at?: string
          created_by?: string | null
          id?: string
          last_validated_at?: string | null
          updated_at?: string
          updated_by?: string | null
          validated_permissions?: Json | null
          validation_tenant_id?: string | null
        }
        Relationships: []
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
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_required?: boolean
          permission_name: string
          permission_type?: string
          submodule: Database["public"]["Enums"]["m365_submodule"]
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_required?: boolean
          permission_name?: string
          permission_type?: string
          submodule?: Database["public"]["Enums"]["m365_submodule"]
        }
        Relationships: []
      }
      m365_tenant_permissions: {
        Row: {
          created_at: string
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
          connection_status: Database["public"]["Enums"]["tenant_connection_status"]
          created_at: string
          created_by: string | null
          display_name: string | null
          id: string
          last_validated_at: string | null
          tenant_domain: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          client_id: string
          connection_status?: Database["public"]["Enums"]["tenant_connection_status"]
          created_at?: string
          created_by?: string | null
          display_name?: string | null
          id?: string
          last_validated_at?: string | null
          tenant_domain?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          connection_status?: Database["public"]["Enums"]["tenant_connection_status"]
          created_at?: string
          created_by?: string | null
          display_name?: string | null
          id?: string
          last_validated_at?: string | null
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
      modules: {
        Row: {
          code: Database["public"]["Enums"]["scope_module"]
          created_at: string
          description: string | null
          icon: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          code: Database["public"]["Enums"]["scope_module"]
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          code?: Database["public"]["Enums"]["scope_module"]
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
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
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
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          module_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          module_id?: string
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
      get_module_permission: {
        Args: { _module_name: string; _user_id: string }
        Returns: Database["public"]["Enums"]["module_permission"]
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
      has_module_access: {
        Args: {
          _module_code: Database["public"]["Enums"]["scope_module"]
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_client_admin: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "super_admin" | "workspace_admin" | "user" | "super_suporte"
      m365_submodule:
        | "entra_id"
        | "sharepoint"
        | "exchange"
        | "defender"
        | "intune"
      module_permission: "view" | "edit" | "full"
      permission_status: "granted" | "pending" | "denied" | "missing"
      schedule_frequency: "daily" | "weekly" | "monthly" | "manual"
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
      app_role: ["super_admin", "workspace_admin", "user", "super_suporte"],
      m365_submodule: [
        "entra_id",
        "sharepoint",
        "exchange",
        "defender",
        "intune",
      ],
      module_permission: ["view", "edit", "full"],
      permission_status: ["granted", "pending", "denied", "missing"],
      schedule_frequency: ["daily", "weekly", "monthly", "manual"],
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
