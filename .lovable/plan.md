

## Ajuste: Exibir período agregado nos Analyzers M365

### Contexto
As três páginas de Analyzer M365 exibem apenas "Última coleta" com a data. O Firewall Analyzer exibe também "Período agregado" (com range de datas) e o badge de "N coletas". Os dados necessários (`period_start`, `period_end`, `snapshotCount`) já existem no `analyzerSnapshot` retornado pelo hook `useLatestM365AnalyzerSnapshot`.

### Alterações

Nas três páginas, substituir o bloco "Last analysis info" atual (que só mostra `analyzedAt`) pelo padrão completo do Firewall Analyzer:

**Arquivos afetados:**
1. `src/pages/m365/ExchangeAnalyzerPage.tsx` (linhas 241-248)
2. `src/pages/m365/EntraIdAnalyzerPage.tsx` (linhas 198-206)
3. `src/pages/m365/TeamsAnalyzerPage.tsx` (linhas 179-187)

**De:**
```tsx
{analyzedAt && (
  <div className="flex items-center gap-3 flex-wrap mb-8">
    <Clock className="w-4 h-4 text-muted-foreground" />
    <span className="text-sm text-muted-foreground">Última coleta</span>
    <Badge variant="outline" className="text-xs">
      {formatDateTimeBR(analyzedAt)}
    </Badge>
  </div>
)}
```

**Para:**
```tsx
{analyzedAt && (
  <div className="flex items-center gap-3 flex-wrap mb-8">
    <Clock className="w-4 h-4 text-muted-foreground" />
    <span className="text-sm text-muted-foreground">Última coleta:</span>
    <Badge variant="outline" className="text-xs">
      {formatDateTimeBR(analyzedAt)}
    </Badge>
    {analyzerSnapshot?.period_start && analyzerSnapshot?.period_end && (
      <>
        <span className="text-sm text-muted-foreground">Período agregado:</span>
        <Badge variant="outline" className="text-xs">
          {formatShortDateTimeBR(analyzerSnapshot.period_start)}
          {' → '}
          {formatShortDateTimeBR(analyzerSnapshot.period_end)}
        </Badge>
      </>
    )}
    {(analyzerSnapshot as any)?.snapshotCount && (
      <Badge variant="secondary" className="text-xs">
        {(analyzerSnapshot as any).snapshotCount} coletas
      </Badge>
    )}
  </div>
)}
```

Cada arquivo também precisará do import de `formatShortDateTimeBR` de `@/lib/dateUtils` (adicionando ao import existente de `formatDateTimeBR`).

