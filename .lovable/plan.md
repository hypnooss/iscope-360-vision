

# Padronizacao de Espacamento e Ajuste do Card Infraestrutura

## Problema identificado

Existem dois padroes de espacamento nas paginas:
- **Padrao A** (Dashboard, Execucoes): `space-y-6` no container principal, sem `mb-*` manuais
- **Padrao B** (Dominios Externos, Relatorios): sem `space-y-*`, usando `mb-8` no header e `mb-6` nos filtros manualmente

## Solucao: padronizar com `space-y-6`

Adotar `space-y-6` como padrao unico, removendo todos os `mb-8` e `mb-6` manuais dos headers e secoes.

## Alteracoes por arquivo

### 1. `src/pages/GeneralDashboardPage.tsx`
- Trocar cor do card Infraestrutura de `primary` (teal) para `violet-500` (nao usada por nenhum modulo: orange=Firewall, blue=M365, green=Ext Domain)
- Ajustar gap dos itens no grid de ativos de `gap-2` para `gap-2.5` (equilibrio entre colado e distante)

### 2. `src/pages/external-domain/ExternalDomainListPage.tsx`
- Container: trocar `<div className="p-6 lg:p-8">` para `<div className="p-6 lg:p-8 space-y-6">`
- Header: remover `mb-8` do div do header
- Os componentes `ExternalDomainStatsCards` e `ExternalDomainTable` ja serao espacados automaticamente pelo `space-y-6`

### 3. `src/pages/external-domain/ExternalDomainReportsPage.tsx`
- Container: trocar `<div className="p-6 lg:p-8">` para `<div className="p-6 lg:p-8 space-y-6">`
- Header: remover `mb-8` do div do header
- Filtros: remover `mb-6` do div dos filtros
- O Card de relatorios ja sera espacado automaticamente

### 4. `src/pages/external-domain/ExternalDomainExecutionsPage.tsx`
- Ja usa `space-y-6` -- nenhuma alteracao necessaria

## Cores do Card Infraestrutura

| Elemento | Antes | Depois |
|----------|-------|--------|
| Borda superior | `border-t-primary` (teal) | `border-t-violet-500` |
| Fundo do icone | `bg-primary/10` | `bg-violet-500/10` |
| Cor do icone | `text-primary` | `text-violet-500` |

## Resumo

| Arquivo | Acao |
|---------|------|
| `GeneralDashboardPage.tsx` | Cor infra card violet + gap 2.5 nos ativos |
| `ExternalDomainListPage.tsx` | Adicionar space-y-6, remover mb-8 |
| `ExternalDomainReportsPage.tsx` | Adicionar space-y-6, remover mb-8 e mb-6 |

