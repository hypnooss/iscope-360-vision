
# Plano: Corrigir Passagem do Domínio para Steps de Análise

## Problema Identificado

A análise de domínio externo falha com o erro "Missing domain" em todos os 7 steps porque o domínio não está sendo passado corretamente para o executor DNS.

### Fluxo Atual (com bug)

```text
1. trigger-external-domain-analysis cria task com payload: { domain: "estrela.com.br" }
2. rpc_get_agent_tasks retorna target: { base_url: "https://estrela.com.br" }
3. Python _build_context NÃO extrai "domain" do target
4. DNSQueryExecutor procura context.get('domain') → não encontra → "Missing domain"
```

### Causa Raiz

O método `_build_context` em `python-agent/agent/tasks.py` não extrai o domínio do `base_url` para incluir no contexto:

```python
def _build_context(self, target: Dict[str, Any]) -> Dict[str, Any]:
    # Falta: extrair domain do base_url ou do target
    return {
        'base_url': target.get('base_url'),
        # 'domain': AUSENTE!
    }
```

## Solução

### Opção 1 (Mais Limpa): Adicionar `domain` no target da RPC

Modificar a função `rpc_get_agent_tasks` para incluir um campo `domain` explícito no target de external_domains:

```sql
json_build_object(
  'id', d.id,
  'type', 'external_domain',
  'domain', d.domain,  -- ADICIONAR
  'base_url', ('https://' || d.domain),
  'credentials', json_build_object()
) as target
```

### Opção 2 (Compatibilidade): Modificar o Python para extrair domain

Alterar `_build_context` para extrair o domínio de `base_url` quando disponível:

```python
def _build_context(self, target: Dict[str, Any]) -> Dict[str, Any]:
    base_url = target.get('base_url') or target.get('url')
    
    # Extrair domain do base_url para steps DNS
    domain = None
    if base_url:
        try:
            from urllib.parse import urlparse
            parsed = urlparse(base_url)
            domain = parsed.netloc or parsed.path.split('/')[0]
        except:
            pass
    
    # Ou usar domain diretamente se disponível no target
    domain = target.get('domain') or domain
    
    return {
        'base_url': base_url,
        'domain': domain,  # ADICIONAR
        # ... resto
    }
```

### Recomendação: Implementar Ambas

Implementar ambas as correções garante compatibilidade e robustez:
1. **Backend (RPC)**: Adicionar campo `domain` explícito para clareza
2. **Python**: Adicionar fallback para extrair domain de base_url

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `rpc_get_agent_tasks` (migração SQL) | Adicionar `domain` ao target de external_domain |
| `python-agent/agent/tasks.py` | Modificar `_build_context` para extrair e incluir `domain` |

## Alteração Detalhada

### 1. Migração SQL para atualizar a RPC

```sql
CREATE OR REPLACE FUNCTION rpc_get_agent_tasks(p_agent_id UUID, p_limit INTEGER DEFAULT 10)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tasks JSON;
BEGIN
  SELECT json_agg(task_data)
  INTO v_tasks
  FROM (
    -- Firewall tasks (mantém como está)
    ...
    
    UNION ALL
    
    -- External domain tasks
    SELECT
      t.id,
      t.task_type,
      t.target_id,
      t.target_type,
      t.payload,
      t.priority,
      t.expires_at,
      json_build_object(
        'id', d.id,
        'type', 'external_domain',
        'domain', d.domain,  -- NOVO CAMPO
        'base_url', ('https://' || d.domain),
        'credentials', json_build_object()
      ) as target,
      ...
  ) as task_data;
  
  ...
END;
$$;
```

### 2. Modificar Python tasks.py

```python
def _build_context(self, target: Dict[str, Any]) -> Dict[str, Any]:
    credentials = target.get('credentials', {})
    base_url = target.get('base_url') or target.get('url')
    
    # Extrair domain do target ou do base_url
    domain = target.get('domain')
    if not domain and base_url:
        try:
            from urllib.parse import urlparse
            parsed = urlparse(base_url)
            domain = parsed.netloc or parsed.path
            if domain:
                domain = domain.split('/')[0].split(':')[0]  # Remove port se houver
        except Exception:
            pass
    
    return {
        'base_url': base_url,
        'domain': domain,  # NOVO
        'api_key': credentials.get('api_key'),
        'host': target.get('host'),
        'port': target.get('port'),
        'credentials': credentials,
        'username': credentials.get('username'),
        'password': credentials.get('password'),
        'community': credentials.get('community'),
    }
```

## Resultado Esperado

Após as correções:
1. A RPC retorna `target.domain = "estrela.com.br"` 
2. O Python extrai `domain` para o contexto
3. O DNSQueryExecutor encontra `context.get('domain')` → "estrela.com.br"
4. Todas as consultas DNS são executadas corretamente

## Testes de Validação

1. Disparar uma nova análise para o domínio estrela.com.br
2. Verificar nos logs do agent que os steps executam sem erro "Missing domain"
3. Confirmar que os resultados (NS, MX, SOA, SPF, DMARC, DKIM, DNSSEC) são salvos no banco
