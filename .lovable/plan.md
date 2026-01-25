

# Configuração do Intervalo de Heartbeat via UI

## Objetivo
Permitir que o super administrador configure o intervalo de heartbeat dos agents diretamente na interface, em **Administração > Configurações**, na nova aba **Agents**.

## Arquitetura da Solução

```text
+------------------+      +---------------------+      +------------------------+
|   SettingsPage   | ---> | system_settings     | <--- | rpc_agent_heartbeat()  |
|   (aba Agents)   |      | (nova tabela)       |      | (função atualizada)    |
+------------------+      +---------------------+      +------------------------+
         |                        |                             |
         v                        v                             v
   Input numérico          key: "agent_heartbeat_interval"    Lê da tabela
   (60-300 segundos)       value: 120 (padrão)                em vez de 120 fixo
```

## Alterações Necessárias

### 1. Criar Tabela de Configurações do Sistema (Database Migration)

```sql
-- Tabela para configurações globais do sistema
CREATE TABLE IF NOT EXISTS public.system_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT NOT NULL UNIQUE,
    value JSONB NOT NULL,
    description TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by UUID REFERENCES auth.users(id)
);

-- Habilitar RLS
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Apenas super_admin pode gerenciar
CREATE POLICY "Super admins can manage system settings"
    ON public.system_settings FOR ALL
    USING (has_role(auth.uid(), 'super_admin'));

-- Qualquer autenticado pode ler (necessário para RPC)
CREATE POLICY "Authenticated users can view system settings"
    ON public.system_settings FOR SELECT
    USING (auth.role() = 'authenticated');

-- Inserir valor padrão do heartbeat
INSERT INTO public.system_settings (key, value, description)
VALUES (
    'agent_heartbeat_interval',
    '120'::jsonb,
    'Intervalo em segundos entre heartbeats dos agents (60-300)'
);

-- Trigger para updated_at
CREATE TRIGGER update_system_settings_updated_at
    BEFORE UPDATE ON public.system_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
```

### 2. Atualizar Função RPC `rpc_agent_heartbeat` (Database Migration)

```sql
CREATE OR REPLACE FUNCTION public.rpc_agent_heartbeat(p_agent_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_agent RECORD;
  v_pending_count INTEGER;
  v_config_flag INTEGER;
  v_heartbeat_interval INTEGER;
BEGIN
  -- Buscar intervalo de heartbeat configurado
  SELECT COALESCE((value::text)::integer, 120)
  INTO v_heartbeat_interval
  FROM system_settings
  WHERE key = 'agent_heartbeat_interval';
  
  -- Fallback se não encontrar
  IF v_heartbeat_interval IS NULL THEN
    v_heartbeat_interval := 120;
  END IF;

  -- Buscar e validar agent
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
  
  -- Atualizar last_seen atomicamente
  UPDATE agents SET last_seen = NOW() WHERE id = p_agent_id;
  
  -- Contar tarefas pendentes não expiradas
  SELECT COUNT(*) INTO v_pending_count
  FROM agent_tasks
  WHERE agent_id = p_agent_id
    AND status = 'pending'
    AND expires_at > NOW();
  
  -- Calcular config_flag
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
    'next_heartbeat_in', v_heartbeat_interval  -- Agora usa valor da tabela
  );
END;
$function$;
```

### 3. Atualizar SettingsPage.tsx - Adicionar Aba "Agents"

**Arquivo**: `src/pages/admin/SettingsPage.tsx`

Adicionar imports:
```typescript
import { Bot } from 'lucide-react';
```

Adicionar estado para configurações de agents:
```typescript
const [agentHeartbeatInterval, setAgentHeartbeatInterval] = useState<number>(120);
const [savingAgentSettings, setSavingAgentSettings] = useState(false);
```

Adicionar função para carregar/salvar configurações:
```typescript
useEffect(() => {
  if (user && role === 'super_admin') {
    loadAgentSettings();
  }
}, [user, role]);

const loadAgentSettings = async () => {
  const { data, error } = await supabase
    .from('system_settings')
    .select('value')
    .eq('key', 'agent_heartbeat_interval')
    .single();
  
  if (data) {
    setAgentHeartbeatInterval(Number(data.value) || 120);
  }
};

const handleSaveAgentSettings = async () => {
  setSavingAgentSettings(true);
  try {
    const { error } = await supabase
      .from('system_settings')
      .upsert({
        key: 'agent_heartbeat_interval',
        value: agentHeartbeatInterval,
        updated_by: user?.id
      }, { onConflict: 'key' });

    if (error) throw error;
    toast.success('Configurações de agents salvas com sucesso');
  } catch (error) {
    toast.error('Erro ao salvar configurações');
  } finally {
    setSavingAgentSettings(false);
  }
};
```

Adicionar nova aba no TabsList:
```tsx
<TabsTrigger value="agents" className="gap-2">
  <Bot className="w-4 h-4" />
  Agents
</TabsTrigger>
```

Adicionar conteúdo da aba:
```tsx
<TabsContent value="agents" className="space-y-6">
  <Card className="border-border/50">
    <CardHeader>
      <CardTitle>Configurações dos Agents</CardTitle>
      <CardDescription>
        Configure o comportamento global dos agents de coleta
      </CardDescription>
    </CardHeader>
    <CardContent className="space-y-6">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="heartbeatInterval">Intervalo de Heartbeat (segundos)</Label>
          <Input
            id="heartbeatInterval"
            type="number"
            min={60}
            max={300}
            value={agentHeartbeatInterval}
            onChange={(e) => setAgentHeartbeatInterval(Number(e.target.value))}
            className="w-[200px]"
          />
          <p className="text-xs text-muted-foreground">
            Define o intervalo entre check-ins dos agents. Valores menores detectam problemas 
            mais rapidamente, mas aumentam o uso de recursos. Recomendado: 60-120 segundos.
          </p>
        </div>

        <div className="bg-muted/30 rounded-lg p-4 space-y-2">
          <h4 className="font-medium text-sm">Sobre o Heartbeat</h4>
          <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
            <li>Agents reportam status e verificam tarefas pendentes a cada intervalo</li>
            <li>Intervalos menores = detecção mais rápida de agents offline</li>
            <li>Intervalos maiores = menor carga no servidor</li>
            <li>A alteração afeta todos os agents na próxima sincronização</li>
          </ul>
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSaveAgentSettings} disabled={savingAgentSettings}>
          {savingAgentSettings ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Save className="w-4 h-4 mr-2" />
          )}
          Salvar Configurações
        </Button>
      </div>
    </CardContent>
  </Card>
</TabsContent>
```

## Resumo Visual

| Componente | Alteração |
|------------|-----------|
| `system_settings` (DB) | Nova tabela para configurações globais |
| `rpc_agent_heartbeat` (DB) | Lê intervalo da tabela em vez de valor fixo |
| `SettingsPage.tsx` | Nova aba "Agents" com input numérico |

## Fluxo de Dados

1. Admin altera o valor na aba Agents (60-300s)
2. Valor é salvo na tabela `system_settings`
3. Função `rpc_agent_heartbeat` lê o valor dinamicamente
4. Agents recebem o novo intervalo no próximo heartbeat
5. Agents ajustam seu ciclo de polling automaticamente

## Validações

- Mínimo: 60 segundos (evita sobrecarga)
- Máximo: 300 segundos (5 minutos - evita detecção lenta de falhas)
- Fallback: 120 segundos se não encontrar configuração

