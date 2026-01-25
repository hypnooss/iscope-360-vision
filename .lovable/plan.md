
# Plano: Auto-Refresh na Tela de Execuções + Redesign Glassmorphism do Alerta

## Visão Geral

Duas melhorias visuais e funcionais para tornar o monitoramento de tarefas mais eficiente e os alertas mais modernos.

---

## Parte 1: Auto-Refresh Inteligente na Tela de Execuções

### Problema Atual
A tela de Execuções não atualiza automaticamente quando há tarefas em andamento. O usuário precisa clicar manualmente no botão "Atualizar" para ver mudanças de status.

### Solução
Adicionar `refetchInterval` dinâmico no `useQuery` que:
- Ativa polling de 10 segundos **apenas quando** existem tarefas com status `pending` ou `running`
- Desativa automaticamente quando todas as tarefas estão finalizadas (economia de recursos)

### Arquivo: `src/pages/firewall/TaskExecutionsPage.tsx`

**Mudança na query (linhas 113-133):**

```typescript
const { data: tasks = [], isLoading, refetch } = useQuery({
  queryKey: ['agent-tasks', statusFilter, timeFilter],
  queryFn: async () => {
    // ... código existente ...
  },
  // NOVO: Auto-refresh quando há tarefas ativas
  refetchInterval: (query) => {
    const data = query.state.data as AgentTask[] | undefined;
    const hasActiveTasks = data?.some(
      t => t.status === 'running' || t.status === 'pending'
    );
    return hasActiveTasks ? 10000 : false; // 10s ou desativado
  },
});
```

**Indicador visual de auto-refresh (opcional):**

Adicionar badge no botão "Atualizar" mostrando quando o auto-refresh está ativo:

```typescript
<Button onClick={() => refetch()} variant="outline" size="sm">
  <RefreshCw className={cn(
    "w-4 h-4 mr-2",
    hasActiveTasks && "animate-spin"
  )} />
  {hasActiveTasks ? 'Atualizando...' : 'Atualizar'}
</Button>
```

---

## Parte 2: Redesign Glassmorphism do SystemAlertBanner

### Problema Atual
O banner atual usa design simples com `border-b` e backgrounds flat, sem efeito de profundidade ou modernidade.

### Referência Visual
Card arredondado com:
- Borda colorida completa (não apenas `border-b`)
- Efeito `backdrop-blur-md` (glassmorphism)
- Ícone dentro de círculo com gradiente
- Botão de ação com estilo `outline` colorido
- Sombra suave para profundidade

### Arquivo: `src/components/alerts/SystemAlertBanner.tsx`

**Novo `getSeverityStyles` com estilos completos:**

```typescript
const getSeverityStyles = (severity: string) => {
  switch (severity) {
    case 'error':
      return {
        border: 'border-destructive/50',
        text: 'text-destructive',
        iconBg: 'bg-gradient-to-br from-destructive/20 to-destructive/5 border-destructive/30',
        buttonClass: 'border-destructive/50 text-destructive hover:bg-destructive/10',
        Icon: AlertCircle,
      };
    case 'warning':
      return {
        border: 'border-yellow-500/50',
        text: 'text-yellow-400',
        iconBg: 'bg-gradient-to-br from-yellow-500/20 to-yellow-500/5 border-yellow-500/30',
        buttonClass: 'border-yellow-500/50 text-yellow-400 hover:bg-yellow-500/10',
        Icon: AlertTriangle,
      };
    case 'success':
      return {
        border: 'border-teal-500/50',
        text: 'text-teal-400',
        iconBg: 'bg-gradient-to-br from-teal-500/20 to-teal-500/5 border-teal-500/30',
        buttonClass: 'border-teal-500/50 text-teal-400 hover:bg-teal-500/10',
        Icon: Shield,
      };
    default: // info
      return {
        border: 'border-blue-500/50',
        text: 'text-blue-400',
        iconBg: 'bg-gradient-to-br from-blue-500/20 to-blue-500/5 border-blue-500/30',
        buttonClass: 'border-blue-500/50 text-blue-400 hover:bg-blue-500/10',
        Icon: Info,
      };
  }
};
```

**Novo layout do banner (linhas 130-187):**

```tsx
return (
  <div className="px-4 pt-4">
    <div className={cn(
      "rounded-lg border backdrop-blur-md",
      "bg-card/80 shadow-lg",
      styles.border
    )}>
      <div className="flex items-center justify-between gap-4 p-4">
        {/* Ícone com círculo gradiente */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className={cn(
            "flex items-center justify-center w-10 h-10 rounded-full border",
            styles.iconBg
          )}>
            <IconComponent className={cn("h-5 w-5", styles.text)} />
          </div>
          
          <div className="flex flex-col min-w-0">
            <span className={cn("font-semibold text-sm", styles.text)}>
              {primaryAlert.title}
            </span>
            <span className="text-xs text-muted-foreground truncate">
              {primaryAlert.message}
            </span>
          </div>
        </div>
        
        {/* Ações */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Botão de ação contextual com estilo outline */}
          {primaryAlert.alert_type === 'firewall_analysis_completed' && 
           primaryAlert.metadata?.firewall_id && (
            <Button
              variant="outline"
              size="sm"
              className={cn("h-8 px-4 text-xs font-medium", styles.buttonClass)}
              asChild
            >
              <Link to={`/scope-firewall/firewalls/${primaryAlert.metadata.firewall_id}/analysis`}>
                Ver Análise
              </Link>
            </Button>
          )}
          
          {/* Botão X para dispensar */}
          <Button
            variant="ghost"
            size="icon"
            className={cn("h-8 w-8", styles.text)}
            onClick={() => dismissAlert(primaryAlert.id)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      {/* Contador de alertas adicionais */}
      {visibleAlerts.length > 1 && (
        <div className="border-t border-border/50 px-4 py-2 text-center">
          <span className="text-xs text-muted-foreground">
            +{visibleAlerts.length - 1} outro(s) alerta(s)
          </span>
        </div>
      )}
    </div>
  </div>
);
```

---

## Resumo das Alterações

| Arquivo | Alteração |
|---------|-----------|
| `TaskExecutionsPage.tsx` | Adicionar `refetchInterval` dinâmico |
| `TaskExecutionsPage.tsx` | Indicador visual de auto-refresh no botão |
| `SystemAlertBanner.tsx` | Novo layout com glassmorphism |
| `SystemAlertBanner.tsx` | Ícone em círculo com gradiente |
| `SystemAlertBanner.tsx` | Botões com estilo outline colorido |

---

## Comparação Visual

### Banner Atual
```text
┌─────────────────────────────────────────────────────┐
│ 🛡️ Análise concluída     [Ver Análise] [X]         │
│ Firewall XYZ analisado                              │
└─────────────────────────────────────────────────────┘
  ^ border-b simples, sem profundidade
```

### Banner Novo (Glassmorphism)
```text
  ╭─────────────────────────────────────────────────────╮
  │  ┌────┐                                             │
  │  │ 🛡️ │  Análise Concluída    [ Ver Análise ] [X]  │
  │  └────┘  Firewall XYZ analisado com sucesso        │
  │          ↑ círculo com gradiente                    │
  ├─────────────────────────────────────────────────────┤
  │            +2 outro(s) alerta(s)                    │
  ╰─────────────────────────────────────────────────────╯
    ^ card arredondado, backdrop-blur, sombra, borda teal
```

---

## Resultado Esperado

**Tela de Execuções:**
- Quando há tarefas `pending` ou `running`, a tabela atualiza automaticamente a cada 10s
- Ícone de refresh gira indicando que o auto-refresh está ativo
- Quando todas as tarefas finalizam, o polling para automaticamente

**Alertas do Sistema:**
- Card moderno com bordas arredondadas e efeito glassmorphism
- Ícone centralizado em círculo com gradiente suave
- Botões de ação com estilo outline que combina com a cor do alerta
- Sombra sutil para dar profundidade
- Visual premium e consistente com o tema dark
