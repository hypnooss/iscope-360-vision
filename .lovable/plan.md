

## Timeline de Execuções por Agendamento

### O que será feito

Cada linha da tabela de agendamentos terá um botão de expansão (chevron). Ao clicar, uma linha extra aparece abaixo com uma timeline visual mostrando o histórico de execuções nas últimas 24h, 48h e 7 dias.

### Abordagem

1. **Estado de expansão**: Adicionar `expandedIds: Set<string>` no `SchedulesTab` para controlar quais linhas estão expandidas.

2. **Coluna de expansão**: Adicionar uma coluna com ícone `ChevronDown`/`ChevronUp` como primeira coluna da tabela. Ao clicar, toggle no set.

3. **Query de histórico**: Criar uma nova query que busca `agent_tasks` dos últimos 7 dias para todos os `targetIds` visíveis:
   ```sql
   SELECT target_id, status, created_at, completed_at, started_at, execution_time_ms, error_message
   FROM agent_tasks
   WHERE target_id IN (...) AND created_at >= now() - interval '7 days'
   ORDER BY created_at DESC
   ```
   Essa query é feita uma vez e filtrada no client por período (24h/48h/7d).

4. **Linha expandida**: Abaixo do `<TableRow>` do schedule, renderizar condicionalmente um `<TableRow>` com `<TableCell colSpan={10}>` contendo:
   - 3 abas/toggle: **24h** | **48h** | **7 dias**
   - Timeline horizontal com dots coloridos por status (verde=completed, vermelho=failed, amarelo=timeout, azul=running)
   - Cada dot mostra tooltip com hora e duração
   - Contadores: total, sucesso, falha

5. **Componente `ScheduleTimeline`**: Novo componente inline no mesmo arquivo que recebe as tasks filtradas e renderiza a timeline.

### Detalhes técnicos

- **Arquivo modificado**: `src/pages/admin/SchedulesPage.tsx`
- **Sem mudanças no banco** — usa a tabela `agent_tasks` existente
- **Componente Collapsible** do Radix já existe no projeto (`src/components/ui/collapsible.tsx`) mas para tabelas é mais limpo usar renderização condicional com `TableRow`
- A query de 7 dias usa `refetchInterval: 60_000` como as demais
- Timeline usa dots pequenos em sequência cronológica com cores por status, agrupados visualmente por dia

### Layout da linha expandida

```text
┌──────────────────────────────────────────────────────────────┐
│  [24h]  [48h]  [7 dias]                                     │
│                                                              │
│  ● ● ● ● ● ● ● ● ● ●    12 execuções | 10 ✓ | 2 ✗         │
│  └─ cada dot = 1 execução, cor = status                     │
│     hover = "17/03 15:30 - Sucesso (4m 12s)"                │
└──────────────────────────────────────────────────────────────┘
```

