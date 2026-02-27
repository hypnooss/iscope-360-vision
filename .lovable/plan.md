

## Plano: Padronizar "Última coleta" no Surface Analyzer

### Problema

A página Surface Analyzer (`SurfaceAnalyzerV3Page.tsx`) usa estilo diferente das demais páginas na seção "Última coleta":

| Aspecto | Surface Analyzer (atual) | Demais páginas (padrão) |
|---|---|---|
| Gap | `gap-2` | `gap-3` |
| flex-wrap | ausente | presente |
| Badge variant | `secondary` + `font-mono` | `outline` |
| Data format | `toLocaleString('pt-BR')` | `toLocaleDateString('pt-BR', { day, month, year, hour, minute })` |

### Correção

**`src/pages/external-domain/SurfaceAnalyzerV3Page.tsx`** (linhas 464-470):
- Mudar `gap-2` → `gap-3 flex-wrap`
- Badge: `variant="outline"` sem `font-mono`
- Data: usar `toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })`

### Arquivo editado (1)
- `src/pages/external-domain/SurfaceAnalyzerV3Page.tsx`

