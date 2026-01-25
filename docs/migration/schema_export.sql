-- =============================================================================
-- InfraScope360 - Schema Export para Migração
-- Gerado em: 2026-01-25
-- Compatível com: Supabase PostgreSQL
-- =============================================================================

-- =============================================================================
-- PARTE 1: EXTENSÕES
-- =============================================================================

-- Extensões padrão do Supabase (já vem habilitadas, mas garantimos)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- PARTE 2: TIPOS ENUM
-- =============================================================================

-- Roles de usuário
CREATE TYPE public.app_role AS ENUM (
  'super_admin',
  'workspace_admin', 
  'user',
  'super_suporte'
);

-- Permissões de módulo
CREATE TYPE public.module_permission AS ENUM (
  'view',
  'edit', 
  'full'
);

-- Status de tarefas do agente
CREATE TYPE public.agent_task_status AS ENUM (
  'pending',
  'running',
  'completed',
  'failed',
  'timeout',
  'cancelled'
);

-- Tipos de tarefas do agente
CREATE TYPE public.agent_task_type AS ENUM (
  'fortigate_compliance',
  'fortigate_cve',
  'ssh_command',
  'snmp_query',
  'ping_check'
);

-- Categorias de dispositivos
CREATE TYPE public.device_category AS ENUM (
  'firewall',
  'switch',
  'router',
  'wlc',
  'server',
  'other'
);

-- Severidade de regras
CREATE TYPE public.rule_severity AS ENUM (
  'critical',
  'high',
  'medium',
  'low',
  'info'
);

-- Frequência de agendamentos
CREATE TYPE public.schedule_frequency AS ENUM (
  'daily',
  'weekly',
  'monthly',
  'manual'
);

-- Submódulos M365
CREATE TYPE public.m365_submodule AS ENUM (
  'entra_id',
  'sharepoint',
  'exchange',
  'defender',
  'intune'
);

-- Status de permissão
CREATE TYPE public.permission_status AS ENUM (
  'granted',
  'pending',
  'denied',
  'missing'
);

-- Status de conexão de tenant
CREATE TYPE public.tenant_connection_status AS ENUM (
  'pending',
  'connected',
  'partial',
  'failed',
  'disconnected'
);

-- Módulos do sistema
CREATE TYPE public.scope_module AS ENUM (
  'scope_firewall',
  'scope_network',
  'scope_cloud',
  'scope_m365'
);

-- =============================================================================
-- PARTE 3: TABELAS
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Tabela: profiles
-- -----------------------------------------------------------------------------
CREATE TABLE public.profiles (
  id UUID NOT NULL PRIMARY KEY,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- Tabela: user_roles
-- -----------------------------------------------------------------------------
CREATE TABLE public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  role public.app_role NOT NULL DEFAULT 'user'::app_role,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

-- -----------------------------------------------------------------------------
-- Tabela: clients
-- -----------------------------------------------------------------------------
CREATE TABLE public.clients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- Tabela: user_clients
-- -----------------------------------------------------------------------------
CREATE TABLE public.user_clients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- Tabela: modules
-- -----------------------------------------------------------------------------
CREATE TABLE public.modules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  color TEXT DEFAULT 'text-primary',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- Tabela: user_modules
-- -----------------------------------------------------------------------------
CREATE TABLE public.user_modules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  module_id UUID NOT NULL REFERENCES public.modules(id) ON DELETE CASCADE,
  permission TEXT NOT NULL DEFAULT 'view',
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, module_id)
);

-- -----------------------------------------------------------------------------
-- Tabela: user_module_permissions
-- -----------------------------------------------------------------------------
CREATE TABLE public.user_module_permissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  module_name TEXT NOT NULL,
  permission public.module_permission NOT NULL DEFAULT 'view',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, module_name)
);

-- -----------------------------------------------------------------------------
-- Tabela: device_types
-- -----------------------------------------------------------------------------
CREATE TABLE public.device_types (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  vendor TEXT NOT NULL,
  category public.device_category NOT NULL DEFAULT 'firewall',
  icon TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- Tabela: device_blueprints
-- -----------------------------------------------------------------------------
CREATE TABLE public.device_blueprints (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  device_type_id UUID NOT NULL REFERENCES public.device_types(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  version TEXT NOT NULL DEFAULT 'any',
  collection_steps JSONB NOT NULL DEFAULT '{"steps": []}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- Tabela: compliance_rules
-- -----------------------------------------------------------------------------
CREATE TABLE public.compliance_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  device_type_id UUID NOT NULL REFERENCES public.device_types(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  severity public.rule_severity NOT NULL DEFAULT 'medium',
  weight INTEGER NOT NULL DEFAULT 1,
  evaluation_logic JSONB NOT NULL,
  pass_description TEXT,
  fail_description TEXT,
  recommendation TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (device_type_id, code)
);

-- -----------------------------------------------------------------------------
-- Tabela: agents
-- -----------------------------------------------------------------------------
CREATE TABLE public.agents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  activation_code TEXT,
  activation_code_expires_at TIMESTAMP WITH TIME ZONE,
  jwt_secret TEXT,
  revoked BOOLEAN NOT NULL DEFAULT false,
  last_seen TIMESTAMP WITH TIME ZONE,
  config_updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  config_fetched_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- Tabela: firewalls
-- -----------------------------------------------------------------------------
CREATE TABLE public.firewalls (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  device_type_id UUID REFERENCES public.device_types(id),
  agent_id UUID REFERENCES public.agents(id) ON DELETE SET NULL,
  fortigate_url TEXT NOT NULL,
  api_key TEXT NOT NULL,
  auth_username TEXT,
  auth_password TEXT,
  serial_number TEXT,
  description TEXT,
  last_score INTEGER,
  last_analysis_at TIMESTAMP WITH TIME ZONE,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- Tabela: agent_tasks
-- -----------------------------------------------------------------------------
CREATE TABLE public.agent_tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  task_type public.agent_task_type NOT NULL,
  target_id UUID NOT NULL,
  target_type TEXT NOT NULL DEFAULT 'firewall',
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  priority INTEGER NOT NULL DEFAULT 5,
  status public.agent_task_status NOT NULL DEFAULT 'pending',
  result JSONB,
  step_results JSONB,
  error_message TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 3,
  execution_time_ms INTEGER,
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (now() + INTERVAL '1 hour'),
  timeout_at TIMESTAMP WITH TIME ZONE,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- Tabela: task_step_results
-- -----------------------------------------------------------------------------
CREATE TABLE public.task_step_results (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES public.agent_tasks(id) ON DELETE CASCADE,
  step_id TEXT NOT NULL,
  status TEXT NOT NULL,
  data JSONB,
  error_message TEXT,
  duration_ms INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- Tabela: analysis_history
-- -----------------------------------------------------------------------------
CREATE TABLE public.analysis_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  firewall_id UUID NOT NULL REFERENCES public.firewalls(id) ON DELETE CASCADE,
  score INTEGER NOT NULL,
  report_data JSONB NOT NULL,
  analyzed_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- Tabela: analysis_schedules
-- -----------------------------------------------------------------------------
CREATE TABLE public.analysis_schedules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  firewall_id UUID NOT NULL REFERENCES public.firewalls(id) ON DELETE CASCADE UNIQUE,
  frequency public.schedule_frequency NOT NULL DEFAULT 'weekly',
  is_active BOOLEAN NOT NULL DEFAULT true,
  next_run_at TIMESTAMP WITH TIME ZONE,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- Tabela: m365_tenants
-- -----------------------------------------------------------------------------
CREATE TABLE public.m365_tenants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  tenant_id TEXT NOT NULL,
  display_name TEXT,
  tenant_domain TEXT,
  connection_status public.tenant_connection_status NOT NULL DEFAULT 'pending',
  last_validated_at TIMESTAMP WITH TIME ZONE,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (client_id, tenant_id)
);

-- -----------------------------------------------------------------------------
-- Tabela: m365_app_credentials
-- -----------------------------------------------------------------------------
CREATE TABLE public.m365_app_credentials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_record_id UUID NOT NULL REFERENCES public.m365_tenants(id) ON DELETE CASCADE UNIQUE,
  azure_app_id TEXT NOT NULL,
  auth_type TEXT NOT NULL DEFAULT 'client_secret',
  client_secret_encrypted TEXT,
  certificate_thumbprint TEXT,
  expires_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- Tabela: m365_tokens
-- -----------------------------------------------------------------------------
CREATE TABLE public.m365_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_record_id UUID NOT NULL REFERENCES public.m365_tenants(id) ON DELETE CASCADE,
  access_token_encrypted TEXT,
  refresh_token_encrypted TEXT,
  token_type TEXT DEFAULT 'Bearer',
  scope TEXT,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- Tabela: m365_tenant_submodules
-- -----------------------------------------------------------------------------
CREATE TABLE public.m365_tenant_submodules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_record_id UUID NOT NULL REFERENCES public.m365_tenants(id) ON DELETE CASCADE,
  submodule public.m365_submodule NOT NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  sync_status TEXT DEFAULT 'pending',
  last_sync_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (tenant_record_id, submodule)
);

-- -----------------------------------------------------------------------------
-- Tabela: m365_tenant_permissions
-- -----------------------------------------------------------------------------
CREATE TABLE public.m365_tenant_permissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_record_id UUID NOT NULL REFERENCES public.m365_tenants(id) ON DELETE CASCADE,
  permission_name TEXT NOT NULL,
  permission_type TEXT NOT NULL DEFAULT 'Application',
  status public.permission_status NOT NULL DEFAULT 'pending',
  granted_at TIMESTAMP WITH TIME ZONE,
  granted_by TEXT,
  error_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (tenant_record_id, permission_name)
);

-- -----------------------------------------------------------------------------
-- Tabela: m365_required_permissions
-- -----------------------------------------------------------------------------
CREATE TABLE public.m365_required_permissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  submodule public.m365_submodule NOT NULL,
  permission_name TEXT NOT NULL,
  permission_type TEXT NOT NULL DEFAULT 'Application',
  description TEXT,
  is_required BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (submodule, permission_name)
);

-- -----------------------------------------------------------------------------
-- Tabela: m365_global_config
-- -----------------------------------------------------------------------------
CREATE TABLE public.m365_global_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  app_id TEXT NOT NULL,
  client_secret_encrypted TEXT NOT NULL,
  validation_tenant_id TEXT,
  validated_permissions JSONB DEFAULT '[]'::jsonb,
  last_validated_at TIMESTAMP WITH TIME ZONE,
  created_by UUID,
  updated_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- Tabela: m365_audit_logs
-- -----------------------------------------------------------------------------
CREATE TABLE public.m365_audit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_record_id UUID REFERENCES public.m365_tenants(id) ON DELETE SET NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  user_id UUID,
  action TEXT NOT NULL,
  action_details JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- Tabela: admin_activity_logs
-- -----------------------------------------------------------------------------
CREATE TABLE public.admin_activity_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_id UUID NOT NULL,
  action TEXT NOT NULL,
  action_type TEXT NOT NULL DEFAULT 'general',
  target_type TEXT,
  target_id UUID,
  target_name TEXT,
  details JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- Tabela: system_settings
-- -----------------------------------------------------------------------------
CREATE TABLE public.system_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  value JSONB NOT NULL,
  description TEXT,
  updated_by UUID,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- Tabela: system_alerts
-- -----------------------------------------------------------------------------
CREATE TABLE public.system_alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  alert_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'warning',
  target_role public.app_role,
  is_active BOOLEAN NOT NULL DEFAULT true,
  dismissed_by UUID[] DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- Tabela: rate_limits
-- -----------------------------------------------------------------------------
CREATE TABLE public.rate_limits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  ip_address TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índice para limpeza de rate limits
CREATE INDEX idx_rate_limits_created_at ON public.rate_limits(created_at);

-- =============================================================================
-- PARTE 4: FUNÇÕES
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Função: has_role
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- -----------------------------------------------------------------------------
-- Função: is_admin
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('super_admin', 'workspace_admin')
  )
$$;

-- -----------------------------------------------------------------------------
-- Função: is_client_admin
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_client_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'workspace_admin') OR public.has_role(_user_id, 'super_admin')
$$;

-- -----------------------------------------------------------------------------
-- Função: has_client_access
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.has_client_access(_user_id uuid, _client_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    public.has_role(_user_id, 'super_admin') OR
    EXISTS (
      SELECT 1
      FROM public.user_clients
      WHERE user_id = _user_id
        AND client_id = _client_id
    )
$$;

-- -----------------------------------------------------------------------------
-- Função: has_module_access (scope_module)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.has_module_access(_user_id uuid, _module_code scope_module)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.user_modules um
    JOIN public.modules m ON um.module_id = m.id
    WHERE um.user_id = _user_id 
    AND m.code = _module_code::text
    AND m.is_active = true
  ) OR has_role(_user_id, 'super_admin')
$$;

-- -----------------------------------------------------------------------------
-- Função: has_module_access (text)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.has_module_access(_user_id uuid, _module_code text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.user_modules um
    JOIN public.modules m ON um.module_id = m.id
    WHERE um.user_id = _user_id 
    AND m.code = _module_code
    AND m.is_active = true
  ) OR has_role(_user_id, 'super_admin')
$$;

-- -----------------------------------------------------------------------------
-- Função: get_module_permission
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_module_permission(_user_id uuid, _module_name text)
RETURNS module_permission
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT permission FROM public.user_module_permissions 
     WHERE user_id = _user_id AND module_name = _module_name),
    'view'::module_permission
  )
$$;

-- -----------------------------------------------------------------------------
-- Função: get_user_modules
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_user_modules(_user_id uuid)
RETURNS TABLE(module_id uuid, code scope_module, name text, description text, icon text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT m.id, m.code::scope_module, m.name, m.description, m.icon
  FROM public.modules m
  WHERE m.is_active = true
  AND (
    has_role(_user_id, 'super_admin')
    OR EXISTS (
      SELECT 1 FROM public.user_modules um
      WHERE um.user_id = _user_id AND um.module_id = m.id
    )
  )
$$;

-- -----------------------------------------------------------------------------
-- Função: can_manage_user
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.can_manage_user(_admin_id uuid, _target_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    public.has_role(_admin_id, 'super_admin')
    OR
    (
      public.has_role(_admin_id, 'workspace_admin')
      AND EXISTS (
        SELECT 1
        FROM public.user_clients admin_clients
        JOIN public.user_clients target_clients ON admin_clients.client_id = target_clients.client_id
        WHERE admin_clients.user_id = _admin_id
        AND target_clients.user_id = _target_user_id
      )
    )
$$;

-- -----------------------------------------------------------------------------
-- Função: update_updated_at_column
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- -----------------------------------------------------------------------------
-- Função: handle_new_user
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id, 
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email)
  );
  
  -- Primeiro usuário é super_admin
  IF (SELECT COUNT(*) FROM public.user_roles) = 0 THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'super_admin');
    
    INSERT INTO public.user_module_permissions (user_id, module_name, permission)
    VALUES 
      (NEW.id, 'dashboard', 'full'),
      (NEW.id, 'firewall', 'full'),
      (NEW.id, 'reports', 'full'),
      (NEW.id, 'users', 'full'),
      (NEW.id, 'm365', 'full');
  ELSE
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'user');
    
    INSERT INTO public.user_module_permissions (user_id, module_name, permission)
    VALUES 
      (NEW.id, 'dashboard', 'view'),
      (NEW.id, 'firewall', 'view'),
      (NEW.id, 'reports', 'view');
  END IF;
  
  RETURN NEW;
END;
$$;

-- -----------------------------------------------------------------------------
-- Função: cleanup_old_rate_limits
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cleanup_old_rate_limits()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.rate_limits 
  WHERE created_at < now() - INTERVAL '24 hours';
  RETURN NEW;
END;
$$;

-- -----------------------------------------------------------------------------
-- Função: cleanup_stuck_tasks
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cleanup_stuck_tasks()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE agent_tasks
  SET 
    status = 'timeout',
    error_message = 'Task excedeu tempo máximo de execução (15 min)',
    completed_at = NOW()
  WHERE status = 'running'
    AND (
      timeout_at IS NOT NULL AND timeout_at < NOW()
      OR
      timeout_at IS NULL AND started_at < NOW() - INTERVAL '15 minutes'
    );
END;
$$;

-- -----------------------------------------------------------------------------
-- Função: cleanup_old_step_results
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cleanup_old_step_results()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.task_step_results
  WHERE task_id IN (
    SELECT id FROM public.agent_tasks 
    WHERE status IN ('completed', 'failed', 'timeout')
    AND completed_at < NOW() - INTERVAL '24 hours'
  );
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- -----------------------------------------------------------------------------
-- Função: rpc_agent_heartbeat
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_agent_heartbeat(p_agent_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_agent RECORD;
  v_pending_count INTEGER;
  v_config_flag INTEGER;
  v_heartbeat_interval INTEGER;
BEGIN
  SELECT COALESCE((value#>>'{}')::integer, 120)
  INTO v_heartbeat_interval
  FROM system_settings
  WHERE key = 'agent_heartbeat_interval';
  
  IF v_heartbeat_interval IS NULL THEN
    v_heartbeat_interval := 120;
  END IF;

  SELECT id, jwt_secret, revoked, config_updated_at, config_fetched_at
  INTO v_agent
  FROM agents
  WHERE id = p_agent_id;
  
  IF NOT FOUND THEN
    RETURN json_build_object('error', 'AGENT_NOT_FOUND', 'success', false);
  END IF;
  
  IF v_agent.revoked THEN
    RETURN json_build_object('error', 'BLOCKED', 'success', false);
  END IF;
  
  IF v_agent.jwt_secret IS NULL THEN
    RETURN json_build_object('error', 'UNREGISTERED', 'success', false);
  END IF;
  
  UPDATE agents SET last_seen = NOW() WHERE id = p_agent_id;
  
  SELECT COUNT(*) INTO v_pending_count
  FROM agent_tasks
  WHERE agent_id = p_agent_id
    AND status = 'pending'
    AND expires_at > NOW();
  
  v_config_flag := CASE 
    WHEN v_agent.config_updated_at > COALESCE(v_agent.config_fetched_at, '1970-01-01'::timestamptz)
    THEN 1 ELSE 0 
  END;
  
  RETURN json_build_object(
    'success', true,
    'agent_id', p_agent_id,
    'jwt_secret', v_agent.jwt_secret,
    'config_flag', v_config_flag,
    'has_pending_tasks', v_pending_count > 0,
    'next_heartbeat_in', v_heartbeat_interval
  );
END;
$$;

-- -----------------------------------------------------------------------------
-- Função: rpc_get_agent_tasks
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_get_agent_tasks(p_agent_id uuid, p_limit integer DEFAULT 10)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tasks JSON;
BEGIN
  SELECT json_agg(task_data)
  INTO v_tasks
  FROM (
    SELECT 
      t.id,
      t.task_type,
      t.target_id,
      t.target_type,
      t.payload,
      t.priority,
      t.expires_at,
      json_build_object(
        'id', f.id,
        'type', 'firewall',
        'base_url', f.fortigate_url,
        'credentials', json_build_object(
          'api_key', f.api_key,
          'username', f.auth_username,
          'password', f.auth_password
        )
      ) as target,
      COALESCE(
        (
          SELECT db.collection_steps
          FROM device_blueprints db
          WHERE db.device_type_id = COALESCE(f.device_type_id, (
            SELECT id FROM device_types WHERE code = 'fortigate' AND is_active = true LIMIT 1
          ))
          AND db.is_active = true
          ORDER BY db.version DESC
          LIMIT 1
        ),
        '{"steps": []}'::jsonb
      ) as blueprint
    FROM agent_tasks t
    LEFT JOIN firewalls f ON t.target_id = f.id AND t.target_type = 'firewall'
    WHERE t.agent_id = p_agent_id
      AND t.status = 'pending'
      AND t.expires_at > NOW()
    ORDER BY t.priority DESC, t.created_at ASC
    LIMIT p_limit
  ) as task_data;
  
  UPDATE agent_tasks
  SET 
    status = 'running',
    started_at = NOW(),
    timeout_at = NOW() + INTERVAL '15 minutes'
  WHERE id IN (
    SELECT id FROM agent_tasks
    WHERE agent_id = p_agent_id
      AND status = 'pending'
      AND expires_at > NOW()
    ORDER BY priority DESC, created_at ASC
    LIMIT p_limit
  );
  
  RETURN COALESCE(v_tasks, '[]'::json);
END;
$$;

-- =============================================================================
-- PARTE 5: TRIGGERS
-- =============================================================================

-- Trigger para criar perfil quando usuário é criado
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Triggers para atualizar updated_at automaticamente
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_clients_updated_at
  BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_modules_updated_at
  BEFORE UPDATE ON public.modules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_device_types_updated_at
  BEFORE UPDATE ON public.device_types
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_device_blueprints_updated_at
  BEFORE UPDATE ON public.device_blueprints
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_compliance_rules_updated_at
  BEFORE UPDATE ON public.compliance_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_firewalls_updated_at
  BEFORE UPDATE ON public.firewalls
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_analysis_schedules_updated_at
  BEFORE UPDATE ON public.analysis_schedules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_m365_tenants_updated_at
  BEFORE UPDATE ON public.m365_tenants
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_m365_app_credentials_updated_at
  BEFORE UPDATE ON public.m365_app_credentials
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_m365_tokens_updated_at
  BEFORE UPDATE ON public.m365_tokens
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_m365_tenant_submodules_updated_at
  BEFORE UPDATE ON public.m365_tenant_submodules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_m365_tenant_permissions_updated_at
  BEFORE UPDATE ON public.m365_tenant_permissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_m365_global_config_updated_at
  BEFORE UPDATE ON public.m365_global_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_system_settings_updated_at
  BEFORE UPDATE ON public.system_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_system_alerts_updated_at
  BEFORE UPDATE ON public.system_alerts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger para limpar rate limits antigos
CREATE TRIGGER cleanup_rate_limits_trigger
  AFTER INSERT ON public.rate_limits
  FOR EACH STATEMENT EXECUTE FUNCTION public.cleanup_old_rate_limits();

-- =============================================================================
-- PARTE 6: RLS (Row Level Security)
-- =============================================================================

-- Habilitar RLS em todas as tabelas
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_module_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_blueprints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.firewalls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_step_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analysis_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analysis_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.m365_tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.m365_app_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.m365_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.m365_tenant_submodules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.m365_tenant_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.m365_required_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.m365_global_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.m365_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- Políticas: profiles
-- -----------------------------------------------------------------------------
CREATE POLICY "Users can view profiles"
  ON public.profiles FOR SELECT
  USING (
    (auth.uid() = id) OR 
    has_role(auth.uid(), 'super_admin') OR 
    (has_role(auth.uid(), 'workspace_admin') AND EXISTS (
      SELECT 1 FROM user_clients admin_clients
      JOIN user_clients target_clients ON admin_clients.client_id = target_clients.client_id
      WHERE admin_clients.user_id = auth.uid() AND target_clients.user_id = profiles.id
    ))
  );

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Super admins can delete profiles"
  ON public.profiles FOR DELETE
  USING (has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Workspace admins can delete managed profiles"
  ON public.profiles FOR DELETE
  USING (
    has_role(auth.uid(), 'workspace_admin') AND EXISTS (
      SELECT 1 FROM user_clients admin_clients
      JOIN user_clients target_clients ON admin_clients.client_id = target_clients.client_id
      WHERE admin_clients.user_id = auth.uid() AND target_clients.user_id = profiles.id
    )
  );

-- -----------------------------------------------------------------------------
-- Políticas: user_roles
-- -----------------------------------------------------------------------------
CREATE POLICY "Users can view roles"
  ON public.user_roles FOR SELECT
  USING (
    (user_id = auth.uid()) OR 
    has_role(auth.uid(), 'super_admin') OR 
    (has_role(auth.uid(), 'workspace_admin') AND EXISTS (
      SELECT 1 FROM user_clients admin_clients
      JOIN user_clients target_clients ON admin_clients.client_id = target_clients.client_id
      WHERE admin_clients.user_id = auth.uid() AND target_clients.user_id = user_roles.user_id
    ))
  );

CREATE POLICY "Admins can manage roles"
  ON public.user_roles FOR ALL
  USING (
    has_role(auth.uid(), 'super_admin') OR 
    (has_role(auth.uid(), 'workspace_admin') AND role <> 'super_admin' AND EXISTS (
      SELECT 1 FROM user_clients admin_clients
      JOIN user_clients target_clients ON admin_clients.client_id = target_clients.client_id
      WHERE admin_clients.user_id = auth.uid() AND target_clients.user_id = user_roles.user_id
    ))
  );

-- -----------------------------------------------------------------------------
-- Políticas: clients
-- -----------------------------------------------------------------------------
CREATE POLICY "Super admins can manage all clients"
  ON public.clients FOR ALL
  USING (has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Admins can view assigned clients"
  ON public.clients FOR SELECT
  USING (has_client_access(auth.uid(), id));

CREATE POLICY "Admins can update assigned clients"
  ON public.clients FOR UPDATE
  USING (
    has_role(auth.uid(), 'workspace_admin') AND 
    has_client_access(auth.uid(), id) AND 
    get_module_permission(auth.uid(), 'firewall') IN ('edit', 'full')
  );

-- -----------------------------------------------------------------------------
-- Políticas: user_clients
-- -----------------------------------------------------------------------------
CREATE POLICY "Users can view client associations"
  ON public.user_clients FOR SELECT
  USING (
    (user_id = auth.uid()) OR 
    has_role(auth.uid(), 'super_admin') OR 
    (has_role(auth.uid(), 'workspace_admin') AND has_client_access(auth.uid(), client_id))
  );

CREATE POLICY "Admins can manage client associations"
  ON public.user_clients FOR ALL
  USING (
    has_role(auth.uid(), 'super_admin') OR 
    (has_role(auth.uid(), 'workspace_admin') AND has_client_access(auth.uid(), client_id))
  );

-- -----------------------------------------------------------------------------
-- Políticas: modules
-- -----------------------------------------------------------------------------
CREATE POLICY "Users can view active modules"
  ON public.modules FOR SELECT
  USING (is_active = true);

CREATE POLICY "Super admins can manage modules"
  ON public.modules FOR ALL
  USING (has_role(auth.uid(), 'super_admin'));

-- -----------------------------------------------------------------------------
-- Políticas: user_modules
-- -----------------------------------------------------------------------------
CREATE POLICY "Users can view own module access"
  ON public.user_modules FOR SELECT
  USING (
    (user_id = auth.uid()) OR 
    has_role(auth.uid(), 'super_admin') OR 
    (has_role(auth.uid(), 'workspace_admin') AND EXISTS (
      SELECT 1 FROM user_clients admin_clients
      JOIN user_clients target_clients ON admin_clients.client_id = target_clients.client_id
      WHERE admin_clients.user_id = auth.uid() AND target_clients.user_id = user_modules.user_id
    ))
  );

CREATE POLICY "Admins can manage user module access"
  ON public.user_modules FOR ALL
  USING (
    has_role(auth.uid(), 'super_admin') OR 
    (has_role(auth.uid(), 'workspace_admin') AND EXISTS (
      SELECT 1 FROM user_clients admin_clients
      JOIN user_clients target_clients ON admin_clients.client_id = target_clients.client_id
      WHERE admin_clients.user_id = auth.uid() AND target_clients.user_id = user_modules.user_id
    ))
  );

-- -----------------------------------------------------------------------------
-- Políticas: user_module_permissions
-- -----------------------------------------------------------------------------
CREATE POLICY "Users can view permissions"
  ON public.user_module_permissions FOR SELECT
  USING (
    (user_id = auth.uid()) OR 
    has_role(auth.uid(), 'super_admin') OR 
    (has_role(auth.uid(), 'workspace_admin') AND EXISTS (
      SELECT 1 FROM user_clients admin_clients
      JOIN user_clients target_clients ON admin_clients.client_id = target_clients.client_id
      WHERE admin_clients.user_id = auth.uid() AND target_clients.user_id = user_module_permissions.user_id
    ))
  );

CREATE POLICY "Admins can manage permissions"
  ON public.user_module_permissions FOR ALL
  USING (
    has_role(auth.uid(), 'super_admin') OR 
    (has_role(auth.uid(), 'workspace_admin') AND EXISTS (
      SELECT 1 FROM user_clients admin_clients
      JOIN user_clients target_clients ON admin_clients.client_id = target_clients.client_id
      WHERE admin_clients.user_id = auth.uid() AND target_clients.user_id = user_module_permissions.user_id
    ))
  );

-- -----------------------------------------------------------------------------
-- Políticas: device_types
-- -----------------------------------------------------------------------------
CREATE POLICY "Users can view active device types"
  ON public.device_types FOR SELECT
  USING (is_active = true);

CREATE POLICY "Super admins can manage device types"
  ON public.device_types FOR ALL
  USING (has_role(auth.uid(), 'super_admin'));

-- -----------------------------------------------------------------------------
-- Políticas: device_blueprints
-- -----------------------------------------------------------------------------
CREATE POLICY "Users can view active blueprints"
  ON public.device_blueprints FOR SELECT
  USING (is_active = true);

CREATE POLICY "Super admins can manage blueprints"
  ON public.device_blueprints FOR ALL
  USING (has_role(auth.uid(), 'super_admin'));

-- -----------------------------------------------------------------------------
-- Políticas: compliance_rules
-- -----------------------------------------------------------------------------
CREATE POLICY "Users can view active rules"
  ON public.compliance_rules FOR SELECT
  USING (is_active = true);

CREATE POLICY "Super admins can manage rules"
  ON public.compliance_rules FOR ALL
  USING (has_role(auth.uid(), 'super_admin'));

-- -----------------------------------------------------------------------------
-- Políticas: agents
-- -----------------------------------------------------------------------------
CREATE POLICY "Admins can manage all agents"
  ON public.agents FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('workspace_admin', 'super_admin')
    )
  );

CREATE POLICY "Client admins can view their agents"
  ON public.agents FOR SELECT
  USING (
    client_id IN (
      SELECT user_clients.client_id FROM user_clients
      WHERE user_clients.user_id = auth.uid()
    )
  );

-- -----------------------------------------------------------------------------
-- Políticas: firewalls
-- -----------------------------------------------------------------------------
CREATE POLICY "Users can view firewalls of accessible clients"
  ON public.firewalls FOR SELECT
  USING (has_client_access(auth.uid(), client_id));

CREATE POLICY "Users with edit permission can manage firewalls"
  ON public.firewalls FOR ALL
  USING (
    has_client_access(auth.uid(), client_id) AND 
    get_module_permission(auth.uid(), 'firewall') IN ('edit', 'full')
  );

-- -----------------------------------------------------------------------------
-- Políticas: agent_tasks
-- -----------------------------------------------------------------------------
CREATE POLICY "Admins can view agent tasks"
  ON public.agent_tasks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM agents a
      WHERE a.id = agent_tasks.agent_id
      AND (has_role(auth.uid(), 'super_admin') OR 
           (has_role(auth.uid(), 'workspace_admin') AND has_client_access(auth.uid(), a.client_id)))
    )
  );

CREATE POLICY "Admins can manage agent tasks"
  ON public.agent_tasks FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM agents a
      WHERE a.id = agent_tasks.agent_id
      AND (has_role(auth.uid(), 'super_admin') OR 
           (has_role(auth.uid(), 'workspace_admin') AND has_client_access(auth.uid(), a.client_id)))
    )
  );

CREATE POLICY "Service role can manage all tasks"
  ON public.agent_tasks FOR ALL
  USING ((auth.jwt() ->> 'role') = 'service_role');

-- -----------------------------------------------------------------------------
-- Políticas: task_step_results (sem políticas - acesso via service role)
-- -----------------------------------------------------------------------------

-- -----------------------------------------------------------------------------
-- Políticas: analysis_history
-- -----------------------------------------------------------------------------
CREATE POLICY "Users can view history of accessible firewalls"
  ON public.analysis_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM firewalls f
      WHERE f.id = analysis_history.firewall_id
      AND has_client_access(auth.uid(), f.client_id)
    )
  );

CREATE POLICY "Users with edit permission can insert history"
  ON public.analysis_history FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM firewalls f
      WHERE f.id = analysis_history.firewall_id
      AND has_client_access(auth.uid(), f.client_id)
    )
  );

-- -----------------------------------------------------------------------------
-- Políticas: analysis_schedules
-- -----------------------------------------------------------------------------
CREATE POLICY "Users can view schedules of accessible firewalls"
  ON public.analysis_schedules FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM firewalls f
      WHERE f.id = analysis_schedules.firewall_id
      AND has_client_access(auth.uid(), f.client_id)
    )
  );

CREATE POLICY "Users with edit permission can manage schedules"
  ON public.analysis_schedules FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM firewalls f
      WHERE f.id = analysis_schedules.firewall_id
      AND has_client_access(auth.uid(), f.client_id)
      AND get_module_permission(auth.uid(), 'firewall') IN ('edit', 'full')
    )
  );

-- -----------------------------------------------------------------------------
-- Políticas: m365_tenants
-- -----------------------------------------------------------------------------
CREATE POLICY "Users can view tenants of accessible clients"
  ON public.m365_tenants FOR SELECT
  USING (has_client_access(auth.uid(), client_id));

CREATE POLICY "Users with edit permission can manage tenants"
  ON public.m365_tenants FOR ALL
  USING (
    has_role(auth.uid(), 'super_admin') OR 
    (has_client_access(auth.uid(), client_id) AND 
     get_module_permission(auth.uid(), 'm365') IN ('edit', 'full'))
  );

-- -----------------------------------------------------------------------------
-- Políticas: m365_app_credentials
-- -----------------------------------------------------------------------------
CREATE POLICY "Users can view credentials of accessible tenants"
  ON public.m365_app_credentials FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM m365_tenants t
      WHERE t.id = m365_app_credentials.tenant_record_id
      AND has_client_access(auth.uid(), t.client_id)
    )
  );

CREATE POLICY "Users with edit permission can manage credentials"
  ON public.m365_app_credentials FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM m365_tenants t
      WHERE t.id = m365_app_credentials.tenant_record_id
      AND has_client_access(auth.uid(), t.client_id)
      AND get_module_permission(auth.uid(), 'm365') IN ('edit', 'full')
    )
  );

-- -----------------------------------------------------------------------------
-- Políticas: m365_tokens
-- -----------------------------------------------------------------------------
CREATE POLICY "Users with edit permission can manage tokens"
  ON public.m365_tokens FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM m365_tenants t
      WHERE t.id = m365_tokens.tenant_record_id
      AND has_client_access(auth.uid(), t.client_id)
      AND get_module_permission(auth.uid(), 'm365') IN ('edit', 'full')
    )
  );

-- -----------------------------------------------------------------------------
-- Políticas: m365_tenant_submodules
-- -----------------------------------------------------------------------------
CREATE POLICY "Users can view submodules of accessible tenants"
  ON public.m365_tenant_submodules FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM m365_tenants t
      WHERE t.id = m365_tenant_submodules.tenant_record_id
      AND has_client_access(auth.uid(), t.client_id)
    )
  );

CREATE POLICY "Users with edit permission can manage submodules"
  ON public.m365_tenant_submodules FOR ALL
  USING (
    has_role(auth.uid(), 'super_admin') OR 
    EXISTS (
      SELECT 1 FROM m365_tenants t
      WHERE t.id = m365_tenant_submodules.tenant_record_id
      AND has_client_access(auth.uid(), t.client_id)
      AND get_module_permission(auth.uid(), 'm365') IN ('edit', 'full')
    )
  );

-- -----------------------------------------------------------------------------
-- Políticas: m365_tenant_permissions
-- -----------------------------------------------------------------------------
CREATE POLICY "Users can view tenant permissions of accessible tenants"
  ON public.m365_tenant_permissions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM m365_tenants t
      WHERE t.id = m365_tenant_permissions.tenant_record_id
      AND has_client_access(auth.uid(), t.client_id)
    )
  );

CREATE POLICY "Users with edit permission can manage tenant permissions"
  ON public.m365_tenant_permissions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM m365_tenants t
      WHERE t.id = m365_tenant_permissions.tenant_record_id
      AND has_client_access(auth.uid(), t.client_id)
      AND get_module_permission(auth.uid(), 'm365') IN ('edit', 'full')
    )
  );

-- -----------------------------------------------------------------------------
-- Políticas: m365_required_permissions
-- -----------------------------------------------------------------------------
CREATE POLICY "Authenticated users can view required permissions"
  ON public.m365_required_permissions FOR SELECT
  USING (true);

-- -----------------------------------------------------------------------------
-- Políticas: m365_global_config
-- -----------------------------------------------------------------------------
CREATE POLICY "Super admins can view global config"
  ON public.m365_global_config FOR SELECT
  USING (has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admins can insert global config"
  ON public.m365_global_config FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admins can update global config"
  ON public.m365_global_config FOR UPDATE
  USING (has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admins can delete global config"
  ON public.m365_global_config FOR DELETE
  USING (has_role(auth.uid(), 'super_admin'));

-- -----------------------------------------------------------------------------
-- Políticas: m365_audit_logs
-- -----------------------------------------------------------------------------
CREATE POLICY "Users can view audit logs of accessible clients"
  ON public.m365_audit_logs FOR SELECT
  USING ((client_id IS NULL) OR has_client_access(auth.uid(), client_id));

CREATE POLICY "Users with edit permission can insert audit logs"
  ON public.m365_audit_logs FOR INSERT
  WITH CHECK (
    has_role(auth.uid(), 'super_admin') OR 
    ((client_id IS NULL) OR has_client_access(auth.uid(), client_id))
  );

-- -----------------------------------------------------------------------------
-- Políticas: admin_activity_logs
-- -----------------------------------------------------------------------------
CREATE POLICY "Super admins can view all activity logs"
  ON public.admin_activity_logs FOR SELECT
  USING (has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admins can insert activity logs"
  ON public.admin_activity_logs FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'super_admin'));

-- -----------------------------------------------------------------------------
-- Políticas: system_settings
-- -----------------------------------------------------------------------------
CREATE POLICY "Service role can read system settings"
  ON public.system_settings FOR SELECT
  USING (true);

CREATE POLICY "Super admins can manage system settings"
  ON public.system_settings FOR ALL
  USING (has_role(auth.uid(), 'super_admin'));

-- -----------------------------------------------------------------------------
-- Políticas: system_alerts
-- -----------------------------------------------------------------------------
CREATE POLICY "Users can view applicable active alerts"
  ON public.system_alerts FOR SELECT
  USING (
    is_active = true AND 
    ((target_role IS NULL) OR has_role(auth.uid(), target_role)) AND 
    ((expires_at IS NULL) OR (expires_at > now())) AND 
    NOT (auth.uid() = ANY(dismissed_by))
  );

CREATE POLICY "Super admins can manage all alerts"
  ON public.system_alerts FOR ALL
  USING (has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Service role can manage alerts"
  ON public.system_alerts FOR ALL
  USING ((auth.jwt() ->> 'role') = 'service_role');

-- -----------------------------------------------------------------------------
-- Políticas: rate_limits (sem políticas - apenas acesso interno)
-- -----------------------------------------------------------------------------

-- =============================================================================
-- FIM DO SCHEMA
-- =============================================================================
