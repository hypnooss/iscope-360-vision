

# Adicionar botao "Cancelar Scan" ao Attack Surface Analyzer

## Problema
Quando um scan esta em andamento (status `pending` ou `running`), nao existe forma de cancela-lo pela interface. O botao "Disparar Scan" fica desabilitado, impedindo iniciar um novo scan.

## Solucao

### 1. Nova Edge Function: `cancel-attack-surface-scan`

Criar `supabase/functions/cancel-attack-surface-scan/index.ts` que:
- Recebe `client_id` no body
- Busca o snapshot mais recente com status `pending` ou `running` para esse client
- Atualiza o snapshot para `status: 'cancelled'`
- Atualiza todas as `attack_surface_tasks` pendentes/assigned/running desse snapshot para `status: 'cancelled'`
- Retorna sucesso

### 2. Hook de cancelamento em `useAttackSurfaceData.ts`

Adicionar `useAttackSurfaceCancelScan(clientId)` - uma mutation que:
- Chama a edge function `cancel-attack-surface-scan`
- Invalida as queries de snapshots e progress
- Exibe toast de confirmacao

### 3. Botao na pagina `AttackSurfaceAnalyzerPage.tsx`

Quando `isRunning === true`, mostrar um botao "Cancelar" ao lado da barra de progresso (ou substituir o botao "Disparar Scan"). Ao clicar, chama a mutation de cancelamento. Apos cancelar, o botao "Disparar Scan" volta a ficar habilitado.

### Detalhes tecnicos

**Edge Function** (`cancel-attack-surface-scan/index.ts`):
```text
1. Receber { client_id } do body
2. SELECT snapshot com status IN ('pending','running') ORDER BY created_at DESC LIMIT 1
3. UPDATE attack_surface_snapshots SET status='cancelled', completed_at=NOW()
4. UPDATE attack_surface_tasks SET status='cancelled' WHERE snapshot_id=X AND status IN ('pending','assigned','running')
5. Retornar { success: true, cancelled_tasks: count }
```

**Hook** - nova funcao exportada `useAttackSurfaceCancelScan`:
- `useMutation` chamando `supabase.functions.invoke('cancel-attack-surface-scan', { body: { client_id } })`
- `onSuccess`: invalidar queries `attack-surface-snapshots`, `attack-surface-latest`, `attack-surface-progress`

**Pagina** - dentro do card de progresso (linhas 487-500), adicionar botao "Cancelar Scan" com icone `XCircle` e estilo destrutivo/outline. Tambem ajustar o botao "Disparar Scan" para mostrar "Cancelar" quando `isRunning`.

