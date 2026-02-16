

# Renomear menu "Relatórios" para "Compliance" e padronizar a tela

## 1. Renomear e reordenar o menu

No arquivo `src/components/layout/AppLayout.tsx`, a lista de itens do modulo External Domain sera alterada de:

```
Dominios Externos, Analyzer, Execucoes, Relatorios
```

Para:

```
Dominios Externos, Compliance, Analyzer, Execucoes
```

## 2. Padronizar o header da tela

No arquivo `src/pages/external-domain/ExternalDomainReportsPage.tsx`:

- **Breadcrumb**: Alterar o label de "Relatorios" para "Compliance"
- **Titulo**: Alterar de "Relatorios" para "Compliance"
- **Subtitulo**: Manter "Historico de analises de compliance" (ja esta adequado)
- **Wrapper do header**: O header atual (linha 320) usa apenas `<div>`. Sera alterado para `<div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">` para seguir o padrao das outras telas

## Detalhes tecnicos

### Arquivo: `src/components/layout/AppLayout.tsx` (linhas 129-132)

Reordenar os itens do submenu:

```
{ label: 'Dominios Externos', href: '/scope-external-domain/domains', icon: Globe },
{ label: 'Compliance', href: '/scope-external-domain/reports', icon: FileText },
{ label: 'Analyzer', href: '/scope-external-domain/analyzer', icon: Radar },
{ label: 'Execucoes', href: '/scope-external-domain/executions', icon: Activity },
```

### Arquivo: `src/pages/external-domain/ExternalDomainReportsPage.tsx`

**Breadcrumb (linha 316)**: "Relatorios" para "Compliance"

**Header (linhas 320-323)**: Alterar o titulo para "Compliance" e adicionar classes responsivas ao wrapper:

```
<div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
  <div>
    <h1 className="text-2xl font-bold text-foreground">Compliance</h1>
    <p className="text-muted-foreground">Historico de analises de compliance</p>
  </div>
</div>
```

