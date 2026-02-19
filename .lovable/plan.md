
# Barra de Progresso no Firewall Analyzer

## O que precisa ser feito

O Domínio Externo > Analyzer tem uma barra de progresso que:
1. Detecta quando uma análise está em andamento (`pending` ou `running`)
2. Mostra um card com spinner + texto + percentual de progresso
3. Tem um botão "Atualizar" para forçar refresh
4. Quando a análise termina, atualiza automaticamente os dados da tela

O Firewall Analyzer ainda não tem nada disso — só mostra o botão "Executar Análise" e, depois que termina, o usuário precisa atualizar a página manualmente.

---

## Como o status funciona no Firewall Analyzer

O `analyzer_snapshots` tem um campo `status` com valores: `pending`, `processing`, `completed`, `failed`.

Quando o usuário clica "Executar Análise", a edge function `trigger-firewall-analyzer` cria um snapshot com `status: 'pending'` e uma `agent_task` correspondente. O agent então executa e atualiza o snapshot para `processing` e depois `completed`.

A diferença em relação ao Domínio Externo é que o Firewall Analyzer **não tem subtarefas por IP** — é uma tarefa única. Por isso, a barra de progresso será indeterminada (sem percentual real), mostrando apenas o status e o tempo decorrido desde o início.

---

## Mudanças necessárias

### 1. `src/hooks/useAnalyzerData.ts` — Novo hook `useAnalyzerProgress`

Criar um hook que verifica se existe snapshot em andamento para o firewall selecionado, com polling a cada 10 segundos:

```ts
export function useAnalyzerProgress(firewallId?: string) {
  return useQuery({
    queryKey: ['analyzer-progress', firewallId],
    queryFn: async () => {
      if (!firewallId) return null;
      const { data } = await supabase
        .from('analyzer_snapshots' as any)
        .select('id, status, created_at, agent_task_id')
        .eq('firewall_id', firewallId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (!data) return null;
      const snap = data as any;
      if (snap.status === 'completed' || snap.status === 'failed') {
        return { status: snap.status, elapsed: null };
      }
      // Calcular tempo decorrido
      const elapsed = Math.floor((Date.now() - new Date(snap.created_at).getTime()) / 1000);
      return { status: snap.status as string, elapsed, snapshotId: snap.id };
    },
    enabled: !!firewallId,
    refetchInterval: 10000, // polling a cada 10s
    staleTime: 5000,
  });
}
```

### 2. `src/pages/firewall/AnalyzerDashboardPage.tsx` — Adicionar a barra de progresso

**Imports adicionados:**
- `useAnalyzerProgress` do hook
- `Progress` do `@/components/ui/progress`
- `useRef` (já importado via React hooks)

**Nova lógica:**
```ts
const { data: progress, refetch: refetchProgress, isFetching: isRefetchingProgress } = useAnalyzerProgress(selectedFirewall || undefined);
const isRunning = progress?.status === 'pending' || progress?.status === 'processing';

// Auto-refresh do snapshot quando análise terminar
const prevProgressStatus = useRef<string | null>(null);
useEffect(() => {
  const currentStatus = progress?.status ?? null;
  if (
    (currentStatus === 'completed' || currentStatus === 'failed') &&
    prevProgressStatus.current &&
    prevProgressStatus.current !== 'completed' &&
    prevProgressStatus.current !== 'failed'
  ) {
    refetch(); // refetch do useLatestAnalyzerSnapshot
    queryClient.invalidateQueries({ queryKey: ['analyzer-latest', selectedFirewall] });
  }
  prevProgressStatus.current = currentStatus;
}, [progress?.status, selectedFirewall]);
```

**Card de progresso** (inserido após o cabeçalho, antes das severity cards, igual ao do Domínio Externo):
```tsx
{isRunning && progress && (
  <Card className="glass-card border-primary/30">
    <CardContent className="p-4">
      <div className="flex items-center gap-3 mb-2">
        <Loader2 className="w-4 h-4 animate-spin text-primary" />
        <span className="text-sm font-medium">Análise em andamento...</span>
        <div className="flex items-center gap-2 ml-auto">
          {progress.elapsed !== null && (
            <span className="text-xs text-muted-foreground">
              {progress.status === 'pending' ? 'Aguardando agent...' : 'Processando logs...'}
              {' · '}
              {Math.floor(progress.elapsed / 60) > 0
                ? `${Math.floor(progress.elapsed / 60)}m ${progress.elapsed % 60}s`
                : `${progress.elapsed}s`}
            </span>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-xs text-primary hover:text-primary/80"
            onClick={() => refetchProgress()}
            disabled={isRefetchingProgress}
          >
            <Loader2 className={cn("w-3 h-3", isRefetchingProgress && "animate-spin")} />
            Atualizar
          </Button>
        </div>
      </div>
      {/* Barra indeterminada: anima de 0% a 100% em loop enquanto running */}
      <Progress value={progress.status === 'pending' ? 15 : 60} className="h-2" />
    </CardContent>
  </Card>
)}
```

> **Nota sobre o progresso:** Como o analyzer do Firewall é uma tarefa única (diferente do Domínio Externo que tem subtarefas por IP), não há percentual real disponível. A barra mostrará 15% se `pending` (aguardando o agent pegar a tarefa) e 60% se `processing` (agent executando).

**Desabilitar o botão "Executar Análise" enquanto estiver rodando:**
```tsx
<Button onClick={handleTrigger} disabled={triggering || !selectedFirewall || isRunning}>
  {isRunning
    ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Em andamento...</>
    : <><Play className="w-4 h-4 mr-2" />Executar Análise</>}
</Button>
```

---

## Arquivos modificados

| Arquivo | O que muda |
|---|---|
| `src/hooks/useAnalyzerData.ts` | Adicionar `useAnalyzerProgress` — hook com polling a cada 10s |
| `src/pages/firewall/AnalyzerDashboardPage.tsx` | Usar o hook, renderizar o card de progresso, desabilitar botão durante análise, auto-refresh quando terminar |

Nenhuma mudança de banco de dados ou edge function é necessária — os dados já existem na tabela `analyzer_snapshots`.
