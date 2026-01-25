-- =============================================================================
-- Script para Configurar Usuário Admin após Migração
-- =============================================================================
-- 
-- INSTRUÇÕES:
-- 1. Primeiro, crie o usuário via Supabase Dashboard > Authentication > Users
-- 2. Depois execute este script substituindo 'SEU_EMAIL_AQUI' pelo email usado
-- 
-- =============================================================================

-- Substitua pelo seu email
DO $$
DECLARE
  v_email TEXT := 'SEU_EMAIL_AQUI';  -- <-- ALTERE AQUI
  v_user_id UUID;
BEGIN
  -- Buscar ID do usuário
  SELECT id INTO v_user_id FROM auth.users WHERE email = v_email;
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário com email % não encontrado. Crie o usuário primeiro via Dashboard.', v_email;
  END IF;
  
  RAISE NOTICE 'Configurando usuário: % (ID: %)', v_email, v_user_id;
  
  -- Garantir que o profile existe
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (v_user_id, v_email, split_part(v_email, '@', 1))
  ON CONFLICT (id) DO NOTHING;
  
  -- Garantir role super_admin
  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_user_id, 'super_admin')
  ON CONFLICT (user_id) DO UPDATE SET role = 'super_admin';
  
  -- Garantir permissões full em todos os módulos
  INSERT INTO public.user_module_permissions (user_id, module_name, permission)
  VALUES 
    (v_user_id, 'dashboard', 'full'),
    (v_user_id, 'firewall', 'full'),
    (v_user_id, 'reports', 'full'),
    (v_user_id, 'users', 'full'),
    (v_user_id, 'm365', 'full')
  ON CONFLICT (user_id, module_name) DO UPDATE SET permission = 'full';
  
  RAISE NOTICE 'Usuário % configurado com sucesso como super_admin!', v_email;
END $$;

-- =============================================================================
-- Verificação
-- =============================================================================

SELECT 
  p.email,
  p.full_name,
  ur.role,
  array_agg(ump.module_name || ':' || ump.permission) as permissions
FROM profiles p
JOIN user_roles ur ON p.id = ur.user_id
LEFT JOIN user_module_permissions ump ON p.id = ump.user_id
WHERE p.email = 'SEU_EMAIL_AQUI'  -- <-- ALTERE AQUI TAMBÉM
GROUP BY p.email, p.full_name, ur.role;
