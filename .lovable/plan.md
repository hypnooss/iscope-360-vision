

## Correções para Ativar o Novo Executor de Subdomínios

### Problema Identificado

Existem **duas correções** necessárias para ativar o novo `SubdomainEnumExecutor`:

### 1. Corrigir o Mapeamento no `tasks.py`

O arquivo `python-agent/agent/tasks.py` está mapeando incorretamente:

```python
# ATUAL (linha 48) - INCORRETO:
'subdomain_enum': AmassExecutor(logger),  # Alias para blueprints
```

**Correção:**

```python
# Importar o novo executor (adicionar na linha 16)
from agent.executors.subdomain_enum import SubdomainEnumExecutor

# Atualizar o mapeamento (linha 48)
'subdomain_enum': SubdomainEnumExecutor(logger),
```

### 2. Atualizar o Blueprint no Banco de Dados

O blueprint `External Domain DNS Scan` ainda usa `type: 'amass'`:

```json
{
  "id": "subdomain_enum",
  "type": "amass",      <-- Precisa mudar para 'subdomain_enum'
  "config": {
    "mode": "passive",
    "timeout": 300
  }
}
```

**SQL para atualizar:**

```sql
UPDATE device_blueprints 
SET collection_steps = jsonb_set(
  collection_steps,
  '{steps,7,type}',
  '"subdomain_enum"'
)
WHERE id = '27b856b1-3b20-4180-b9da-ea5834c55ac6';
```

Ou manualmente via interface de Administração > Templates > External Domain > Blueprint.

### Resumo das Alterações

| Arquivo/Local | Alteração |
|---------------|-----------|
| `python-agent/agent/tasks.py` | Importar `SubdomainEnumExecutor` e atualizar mapeamento |
| Blueprint no DB | Alterar step `subdomain_enum` de `type: 'amass'` para `type: 'subdomain_enum'` |

### Deploy

1. Atualizar `tasks.py` no servidor
2. Atualizar blueprint (via SQL ou interface admin)
3. Limpar cache Python: `rm -rf /opt/iscope-agent/agent/__pycache__`
4. Reiniciar agent: `systemctl restart iscope-agent`
5. Disparar nova análise de External Domain

