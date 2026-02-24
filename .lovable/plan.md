

# Limpeza de dados do BAU-FW (PRECISIO)

## Dados identificados

| Tabela | Registros | Firewall ID |
|---|---|---|
| `analysis_history` (compliance) | 28 | `98640ddd-0354-4694-84b3-cf7158b1b9aa` |
| `analyzer_snapshots` (analyzer/intelligence) | 148 | `98640ddd-0354-4694-84b3-cf7158b1b9aa` |
| `analyzer_config_changes` | 4 | `98640ddd-0354-4694-84b3-cf7158b1b9aa` |

**Total: 180 registros a serem removidos**

## Execucao

Criar uma edge function temporaria para executar os 3 DELETEs usando service_role (necessario porque as tabelas tem RLS). Apos execucao, a edge function sera removida.

### SQL a executar

```text
DELETE FROM analyzer_config_changes WHERE firewall_id = '98640ddd-0354-4694-84b3-cf7158b1b9aa';
DELETE FROM analyzer_snapshots WHERE firewall_id = '98640ddd-0354-4694-84b3-cf7158b1b9aa';
DELETE FROM analysis_history WHERE firewall_id = '98640ddd-0354-4694-84b3-cf7158b1b9aa';
```

A ordem respeita dependencias (config_changes referencia snapshots).

### Verificacao de agent_tasks relacionadas

Tambem verificarei e limparei `agent_tasks` pendentes para este firewall, caso existam.

## Arquivos

| Arquivo | Acao |
|---|---|
| `supabase/functions/cleanup-firewall-data/index.ts` | Criar (temporario) |

Apos confirmar a exclusao, a edge function sera removida do projeto.

