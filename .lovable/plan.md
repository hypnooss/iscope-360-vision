

# Corrigir tooltip do badge "+N" de tecnologias

## Problemas identificados

1. **Tooltip aparece no card errado** -- O tooltip nao tem seu proprio `TooltipProvider`, dependendo do provider global da pagina. Isso causa posicionamento incorreto.
2. **Exibe apenas os ocultos** -- O tooltip mostra `allTechs.slice(MAX_TECHS)` em vez de todos (`allTechs`).
3. **Layout vertical** -- Os itens sao exibidos em coluna (`flex-col`), mas o usuario quer badges em linha com quebra automatica.

## Mudanca

**Arquivo:** `src/pages/external-domain/AttackSurfaceAnalyzerPage.tsx` (linhas ~1059-1072)

Substituir o bloco do Tooltip por:

- Envolver com `TooltipProvider delayDuration={200}` proprio (mesmo padrao do IP badge na linha 992)
- Alterar o conteudo para exibir **todos** os techs: `asset.allTechs.map(...)` em vez de `asset.allTechs.slice(MAX_TECHS)`
- Trocar `flex-col` por `flex-wrap` com badges coloridas (usando `getTechBadgeColor`)
- Definir `max-w-sm` (~384px) no `TooltipContent` para limitar largura e forcar quebra de linha quando necessario

### Detalhes tecnicos

```text
Antes:
  <Tooltip>
    <TooltipTrigger>...</TooltipTrigger>
    <TooltipContent className="max-w-xs">
      <div className="flex flex-col gap-0.5 text-xs">
        {asset.allTechs.slice(MAX_TECHS).map(...)}  // so os ocultos, texto simples
      </div>
    </TooltipContent>
  </Tooltip>

Depois:
  <TooltipProvider delayDuration={200}>
    <Tooltip>
      <TooltipTrigger>...</TooltipTrigger>
      <TooltipContent side="top" className="max-w-sm p-2">
        <div className="flex flex-wrap gap-1">
          {asset.allTechs.map(...)}  // TODOS, como Badge com cor
        </div>
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
```

