

# Fix: Blueprint sobrescrevendo parâmetros do masscan

## Problema

Os novos defaults do executor masscan (`rate=3000`, `timeout=180`) não estão sendo aplicados porque o blueprint "Active Attack Surface Scan" define explicitamente `"rate": 10000` e `"timeout": 120` nos `params` do step. Como o executor usa `params.get('rate', 3000)`, o valor do blueprint sempre vence.

Os logs confirmam:
```
[masscan] Scanning 144.22.147.65 ports=1-65535 rate=10000
```

## Correção

Criar uma nova migration SQL para atualizar o blueprint no banco de dados com os parâmetros otimizados.

### Nova migration

```sql
UPDATE public.device_blueprints
SET collection_steps = jsonb_set(
  jsonb_set(
    collection_steps,
    '{steps,0,params}',
    '{"port_range": "1-65535", "rate": 3000}'::jsonb
  ),
  '{steps,0,timeout}',
  '180'::jsonb
)
WHERE name = 'Active Attack Surface Scan';
```

### O que muda no blueprint

| Campo | Antes | Depois |
|-------|-------|--------|
| `steps[0].params.rate` | 10000 | 3000 |
| `steps[0].timeout` | 120 | 180 |

Os parâmetros `--retries 2` e `--wait 5` já estão hardcoded no executor e não precisam estar no blueprint.

## Seção Técnica

- 1 novo arquivo: migration SQL em `supabase/migrations/`
- Atualiza o campo JSONB `collection_steps` do blueprint existente
- Sem impacto em outros blueprints ou device types
- Tarefas já criadas na fila continuarão com os params antigos (serão executadas uma vez com rate=10000), mas novas tarefas usarão os valores corrigidos

