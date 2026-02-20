

# Cores Neutras nos Stats Cards

## Problema
Os cards de "CVEs Criticas" e "Certificados Expirados" estao usando `variant="destructive"` (fundo vermelho) e `variant="warning"` (fundo amarelo), o que da a impressao de severidade. Todos os 4 cards devem ter fundo neutro identico, como na referencia do Analyzer V1.

## Alteracao

No arquivo `src/pages/external-domain/SurfaceAnalyzerV3Page.tsx`, trocar o `variant` dos dois ultimos StatCards de `"destructive"` e `"warning"` para `"default"`, igualando todos os 4 cards:

```
<StatCard title="Ativos Expostos"        value={...} icon={Globe}        variant="default" />
<StatCard title="Serviços Detectados"    value={...} icon={Server}       variant="default" />
<StatCard title="CVEs Críticas"          value={...} icon={ShieldAlert}  variant="default" />
<StatCard title="Certificados Expirados" value={...} icon={AlertTriangle} variant="default" />
```

Isso resulta em todos os cards com borda e fundo neutro (`border-primary/30 bg-primary/5`), enquanto cada icone mantem sua cor natural (teal, blue, red, orange) vinda do proprio componente de icone do Lucide.

## Arquivo Afetado

| Arquivo | Acao |
|---|---|
| `src/pages/external-domain/SurfaceAnalyzerV3Page.tsx` | Alterar variant de 2 StatCards (linhas 484-485) |

