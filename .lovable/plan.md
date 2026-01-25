

# Plano: Atualização em Tempo Real + Design Melhorado do Alerta

## Problema 1: Tela de Execuções não atualiza em tempo real

A tarefa foi finalizada pelo agent às 17:43:33, mas a tela continua mostrando "Executando" porque:
- A query usa `useQuery` sem atualização automática
- O botão "Atualizar" faz refresh manual, mas não há polling nem Realtime

## Problema 2: Alerta de sucesso com design simples

O banner atual usa estilos simples (`bg-teal-500/10 border-b`), enquanto a referência mostra:
- Card arredondado com borda colorida
- Efeito de transparência/glassmorphism
- Botão de ação com borda (outline)
- Design mais caprichado e moderno

---

## Solução

### Arquivo 1: `src/pages/firewall/TaskExecutionsPage.tsx`

**Adicionar auto-refresh a cada 10 segundos** para tarefas em execução:

```typescript
const { data: tasks = [], isLoading, refetch } = useQuery({
  queryKey: ['agent-tasks', statusFilter, timeFilter],
  queryFn: async () => { ... },
  // Adicionar refetch automático quando há tarefas running
  refetchInterval: (query) => {
    const data = query.state.data as AgentTask[] | undefined;
    const hasRunning = data?.some(t => t.status === 'running' || t.status === 'pending');
    return hasRunning ? 10000 : false; // 10s se há tarefas pendentes/executando
  },
});
```

Isso faz a tela atualizar automaticamente enquanto houver tarefas em andamento.

---

### Arquivo 2: `src/components/alerts/SystemAlertBanner.tsx`

**Redesign completo do banner** para ficar igual à referência:

**Mudanças visuais:**

| Antes | Depois |
|-------|--------|
| `border-b` simples | Card com `rounded-lg` e `border` completa |
| Background flat | Glassmorphism com `backdrop-blur-md` |
| Botão `ghost` | Botão `outline` com borda colorida |
| Posicionamento sticky top | Card flutuante com margem e sombra |

**Novo container:**
```tsx
<div className={cn(
  "mx-4 mt-4 rounded-lg border backdrop-blur-md",
  "bg-card/80 shadow-lg",
  severityBorderClass // ex: border-teal-500/50
)}>
```

**Novo estilo do ícone (círculo com gradiente):**
```tsx
<div className={cn(
  "flex items-center justify-center w-8 h-8 rounded-full",
  "bg-gradient-to-br from-teal-500/20 to-teal-500/5 border border-teal-500/30"
)}>
  <Shield className="h-4 w-4 text-teal-500" />
</div>
```

**Novo estilo do botão de ação:**
```tsx
<Button
  variant="outline"
  size="sm"
  className={cn(
    "h-8 px-4 text-xs font-medium",
    "border-teal-500/50 text-teal-500 hover:bg-teal-500/10"
  )}
>
  Conectado
</Button>
```

**Estilos por severidade:**

| Severidade | Borda | Texto | Background Ícone |
|------------|-------|-------|------------------|
| success | `border-teal-500/50` | `text-teal-400` | `from-teal-500/20` |
| error | `border-destructive/50` | `text-destructive` | `from-destructive/20` |
| warning | `border-yellow-500/50` | `text-yellow-400` | `from-yellow-500/20` |
| info | `border-blue-500/50` | `text-blue-400` | `from-blue-500/20` |

---

## Impacto

| Arquivo | Ação |
|---------|------|
| `TaskExecutionsPage.tsx` | Adicionar `refetchInterval` dinâmico |
| `SystemAlertBanner.tsx` | Redesign completo do layout e estilos |

| Item | Status |
|------|--------|
| Database | Sem alterações |
| Edge Functions | Sem alterações |
| Deploy | Automático após edição |

---

## Resultado Esperado

**Execuções:**
- Quando uma tarefa está "Executando", a tela atualiza automaticamente a cada 10s
- Assim que o agent finaliza, o status muda para "Concluída" sem precisar clicar em Atualizar

**Alerta:**
- Card arredondado com borda colorida (teal para success)
- Efeito glassmorphism (transparência + blur)
- Ícone dentro de círculo com gradiente
- Botão de ação com borda (outline) colorida
- Visual moderno e caprichado igual à referência

