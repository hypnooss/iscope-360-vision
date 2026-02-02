

# Plano: Ajustar Labels de Stitch/Trigger/Action para incluir "Name"

## Objetivo

Alterar os labels das evidências de backup de:
- "Stitch" → "Stitch Name"
- "Trigger" → "Trigger Name"  
- "Action" → "Action Name"

## Arquivo a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/agent-task-result/index.ts` | Atualizar labels nas linhas 1228-1230 |

## Alteração Específica

**Linhas 1228-1230** - Atualizar de:

```typescript
evidence.push({ label: 'Stitch', value: bestBackup.stitchName, type: 'code' });
evidence.push({ label: 'Trigger', value: bestBackup.triggerName, type: 'code' });
evidence.push({ label: 'Action', value: bestBackup.actionName, type: 'code' });
```

Para:

```typescript
evidence.push({ label: 'Stitch Name', value: bestBackup.stitchName, type: 'code' });
evidence.push({ label: 'Trigger Name', value: bestBackup.triggerName, type: 'code' });
evidence.push({ label: 'Action Name', value: bestBackup.actionName, type: 'code' });
```

## Resultado Esperado

A UI exibirá:
- **Stitch Name:** Backup Mensal
- **Trigger Name:** Backup Mensal
- **Action Name:** Backup Blob

Em vez de:
- **Stitch:** Backup Mensal
- **Trigger:** Backup Mensal
- **Action:** Backup Blob

