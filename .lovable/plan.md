
# Rescan "Testar" deve atualizar o snapshot existente (merge in-place)

## Problema atual

Ao clicar em "Testar", a Edge Function `attack-surface-rescan-ip` cria um **novo snapshot** com apenas 1 IP. Como o frontend exibe o snapshot mais recente (`useLatestAttackSurfaceSnapshot`), o usuario perde a visao completa e ve apenas o IP re-escaneado.

## Solucao

Mudar a abordagem: em vez de criar um novo snapshot, o "Testar" cria uma task vinculada ao **snapshot existente** e, quando concluida, o `attack-surface-step-result` faz o merge dos resultados de volta no snapshot original.

## Plano Tecnico

### 1. Edge Function `attack-surface-rescan-ip` (reescrever)

Mudar a logica para:

1. Receber `client_id`, `ip`, `source`, `label` e **`snapshot_id`** (o snapshot que o usuario esta visualizando)
2. **Nao criar novo snapshot** -- usar o `snapshot_id` recebido
3. Criar uma unica `attack_surface_tasks` vinculada ao snapshot existente
4. Marcar o snapshot como `status: 'running'` para indicar que esta em andamento

```text
Antes:  cria snapshot novo + 1 task -> resultado aparece em snapshot separado
Depois: usa snapshot existente + 1 task -> resultado faz merge no mesmo snapshot
```

### 2. Edge Function `attack-surface-step-result` (ajustar consolidacao)

A consolidacao final (quando `pendingCount === 0`) ja faz o merge de todas as tasks do snapshot. Porem, atualmente ela **substitui** o campo `results` inteiro. Precisa ser ajustada para:

1. Buscar o `results` existente do snapshot
2. Fazer merge: para cada IP da task concluida, sobrescrever apenas aquele IP no `results`
3. Recalcular `summary` e `score` com todos os IPs (existentes + atualizados)
4. Recalcular `cve_matches` incluindo os novos CPEs

Isso garante que os outros IPs do snapshot original permanecem intactos.

### 3. Hook `useAttackSurfaceRescanIP` (passar snapshot_id)

Atualizar o hook para aceitar e enviar o `snapshot_id` junto com os dados do IP:

```typescript
mutationFn: async ({ ip, source, label, snapshotId }) => {
  // ...
  body: { client_id: clientId, ip, source, label, snapshot_id: snapshotId },
}
```

### 4. Pagina `AttackSurfaceAnalyzerPage.tsx`

Passar o `snapshot.id` do snapshot atual na chamada `onRescan`:

```typescript
onRescan={(a) => rescanMutation.mutate({
  ip: a.ip,
  source: a.source,
  label: a.hostname,
  snapshotId: snapshot.id,  // NOVO
})}
```

## Arquivos modificados

| Arquivo | Mudanca |
|---|---|
| `supabase/functions/attack-surface-rescan-ip/index.ts` | Receber `snapshot_id`, nao criar snapshot novo, criar task vinculada ao existente |
| `supabase/functions/attack-surface-step-result/index.ts` | Consolidacao faz merge com `results` existentes do snapshot (nao substitui) |
| `src/hooks/useAttackSurfaceData.ts` | Adicionar `snapshotId` ao payload da mutacao |
| `src/pages/external-domain/AttackSurfaceAnalyzerPage.tsx` | Passar `snapshot.id` na chamada onRescan |

## Fluxo apos a mudanca

```text
1. Usuario clica "Testar" no card do IP 177.55.163.154
2. Frontend envia { client_id, ip, source, label, snapshot_id: "abc-123" }
3. Edge Function cria 1 task vinculada ao snapshot "abc-123", marca status='running'
4. Agente executa a task (asn -> nmap -> httpx)
5. step-result recebe resultado final, faz merge:
   - Busca results existente do snapshot "abc-123"
   - Sobrescreve apenas results["177.55.163.154"] com novos dados
   - Recalcula summary/score com todos os IPs
6. Frontend exibe o mesmo snapshot atualizado com os novos dados do IP
```
