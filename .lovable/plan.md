
# Plano de Migração para Supabase Externo

## Contexto
Você deseja migrar do Lovable Cloud (`pgjervwrvmfmwvfvylvj`) para o Supabase externo (`ovctuytroqngojalgjrs`).

## Estado Atual

### Lovable Cloud (Dados Existentes)
| Categoria | Quantidade |
|-----------|-----------|
| Usuários Auth | 5 (nn.mansberger, thiago.monteiro, etc.) |
| Módulos | 5 (scope_firewall, scope_m365, scope_cloud, scope_network, scope_dominios) |
| Device Types | 2 (FortiGate, SonicWall TZ) |
| Blueprints | 2 (FortiGate, SonicWall) |
| Compliance Rules | 47 regras ativas |
| Clients | 3 (BRINQUEDOS ESTRELA, PRECISIO, NEXTA) |
| Agents | 3 (ESTRELA-ITP, PRECISIO-AZURE, ESTRELA-SAO) |
| Firewalls | 1+ (SAO-FW) |

### Supabase Externo
O projeto `ovctuytroqngojalgjrs` precisa ter **todos estes dados migrados**.

---

## Plano de Execução

### Fase 1: Configuração do Frontend
Alterar o `.env` para apontar para o Supabase externo:

```text
VITE_SUPABASE_PROJECT_ID="ovctuytroqngojalgjrs"
VITE_SUPABASE_PUBLISHABLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im92Y3R1eXRyb3FuZ29qYWxnanJzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkzNzg4NzMsImV4cCI6MjA4NDk1NDg3M30.P-Ar5n7JXPJcW8ZXo7AhWWfsjg7wAoE4UUMcxB2MzDU"
VITE_SUPABASE_URL="https://ovctuytroqngojalgjrs.supabase.co"
```

---

### Fase 2: Seed de Dados no Supabase Externo
**Você precisa executar estas queries no SQL Editor do projeto `ovctuytroqngojalgjrs`:**

#### 2.1 Criar Módulos
```sql
INSERT INTO public.modules (code, name, description, icon, color, is_active) VALUES
  ('scope_firewall', 'Firewall', 'Análise de compliance de firewalls', 'Shield', 'text-orange-500', true),
  ('scope_m365', 'Microsoft 365', 'Análise de compliance Microsoft 365', 'Cloud', 'text-blue-500', true),
  ('scope_network', 'Network', 'Análise de infraestrutura de rede', 'Network', 'text-green-500', true),
  ('scope_cloud', 'Cloud', 'Análise de ambientes cloud', 'Server', 'text-purple-500', true),
  ('scope_dominios', 'Domínios Externos', 'Análise de domínios externos', 'Globe', 'text-cyan-500', true)
ON CONFLICT (code) DO UPDATE SET 
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  is_active = true;
```

#### 2.2 Criar Device Types
```sql
INSERT INTO public.device_types (id, code, name, vendor, category, is_active) VALUES
  ('c2d829a3-4f86-49cd-851f-fa3f10c4fcf6', 'fortigate', 'FortiGate', 'Fortinet', 'firewall', true),
  ('22d07d7d-7b53-4ad4-8061-f1c6ad81da48', 'sonicwall_tz', 'SonicWall TZ', 'SonicWall', 'firewall', true)
ON CONFLICT (id) DO UPDATE SET is_active = true;
```

#### 2.3 Configurar System Settings
```sql
INSERT INTO public.system_settings (key, value, description) VALUES
  ('agent_heartbeat_interval', '60', 'Intervalo de heartbeat dos agents em segundos')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
```

---

### Fase 3: Configurar Usuário Admin
**Após criar o usuário `backup@gmail.com` no Auth do Supabase externo**, execute:

```sql
DO $$
DECLARE
  v_user_id UUID;
  v_email TEXT := 'backup@gmail.com';
BEGIN
  -- Buscar o user_id do Auth
  SELECT id INTO v_user_id FROM auth.users WHERE email = v_email;
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário % não encontrado no auth.users', v_email;
  END IF;
  
  -- Criar profile
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (v_user_id, v_email, 'Administrador Backup')
  ON CONFLICT (id) DO UPDATE SET email = v_email, full_name = 'Administrador Backup';
  
  -- Definir role super_admin
  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_user_id, 'super_admin')
  ON CONFLICT (user_id) DO UPDATE SET role = 'super_admin';
  
  -- Dar permissões em todos os módulos
  INSERT INTO public.user_module_permissions (user_id, module_name, permission)
  VALUES 
    (v_user_id, 'dashboard', 'full'),
    (v_user_id, 'firewall', 'full'),
    (v_user_id, 'reports', 'full'),
    (v_user_id, 'users', 'full'),
    (v_user_id, 'm365', 'full')
  ON CONFLICT (user_id, module_name) DO UPDATE SET permission = 'full';
  
  RAISE NOTICE 'Usuário % configurado com sucesso!', v_email;
END $$;
```

---

### Fase 4: Configurar Secrets no Supabase Externo
No dashboard do projeto externo (**Settings > Edge Functions > Secrets**), adicione:

| Secret Name | Descrição |
|-------------|-----------|
| `M365_ENCRYPTION_KEY` | Chave de 64 caracteres hex para criptografia AES-256 |
| `M365_MULTI_TENANT_APP_ID` | App ID do Azure AD |
| `M365_MULTI_TENANT_CLIENT_SECRET` | Client Secret do Azure AD |

---

### Fase 5: Testar Conexão
1. **Limpar cache do navegador** ou usar janela anônima
2. Acessar a aplicação e fazer login com `backup@gmail.com`
3. Verificar se o sidebar mostra todos os módulos
4. Testar navegação básica

---

## Dados que Precisam Migração Manual (Opcional)
Se você quiser preservar dados operacionais do ambiente atual:

- **Clients**: BRINQUEDOS ESTRELA, PRECISIO, NEXTA
- **Agents**: ESTRELA-ITP, PRECISIO-AZURE, ESTRELA-SAO
- **Firewalls**: SAO-FW e outros
- **Blueprints**: Configurações de coleta FortiGate/SonicWall
- **Compliance Rules**: 47 regras de compliance

Posso gerar scripts SQL para migrar esses dados também, se necessário.

---

## Resumo de Ações

| Etapa | Responsável | Status |
|-------|-------------|--------|
| 1. Atualizar `.env` | Lovable (eu) | Pendente |
| 2. Seed de módulos | Você (SQL Editor) | Pendente |
| 3. Seed de device types | Você (SQL Editor) | Pendente |
| 4. Configurar admin | Você (SQL Editor) | Pendente |
| 5. Configurar secrets | Você (Dashboard) | Pendente |
| 6. Testar login | Você | Pendente |
