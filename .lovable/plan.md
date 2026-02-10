

# Transformar StatCards em filtros clicaveis e adicionar severidades faltantes

## Resumo

Expandir a grade de cards para incluir todas as severidades (Total, Critico, Alto, Medio, Baixo, Acao Necessaria), tornar cada card clicavel para funcionar como filtro, e remover o dropdown de severidade e o botao de "Acao Necessaria" da secao de filtros (ficam redundantes).

## Alteracoes

### 1. StatCard — adicionar suporte a clique e estado ativo (`src/components/StatCard.tsx`)

- Adicionar props opcionais `onClick` e `active` ao componente
- Quando `onClick` estiver presente, renderizar como botao com `cursor-pointer`
- Quando `active` for true, aplicar um anel/borda destacada (ring) para indicar que o filtro esta ativo
- Sem quebrar usos existentes do StatCard em outras paginas

### 2. M365CVEsPage — expandir cards e usar como filtro (`src/pages/m365/M365CVEsPage.tsx`)

**Cards (grid expandida para 6 colunas em desktop):**

| Card | Icone | Variante | Filtro ao clicar |
|------|-------|----------|-----------------|
| Total CVEs | Shield | default | Limpar filtros (mostrar todos) |
| Criticos | ShieldAlert | destructive | severityFilter = CRITICAL |
| Altos | AlertTriangle | warning | severityFilter = HIGH |
| Medios | Info | warning (yellow) | severityFilter = MEDIUM |
| Baixos | Shield | default (blue) | severityFilter = LOW |
| Acao Necessaria | UserCheck | destructive | actionFilter = true |

**Comportamento de toggle:**
- Clicar em um card ativo desativa o filtro (volta para "all" / false)
- Clicar em "Total CVEs" sempre limpa todos os filtros
- Card ativo recebe destaque visual (ring-2)

**Stats devem usar dados nao-filtrados** (contagem do total real, nao dos ja filtrados) para que os numeros nos cards facam sentido como contadores globais.

**Remover da secao de filtros:**
- Dropdown de "Severidade" (linhas 220-234)
- Botao de "Acao Necessaria" (linhas 236-244)
- Manter apenas a linha de filtro por Produtos

### 3. Layout da grid

```
Mobile (grid-cols-3): 6 cards em 2 linhas
Tablet (md:grid-cols-6): todos em 1 linha
```

## Secao tecnica

### StatCard — novas props

```typescript
interface StatCardProps {
  title: string;
  value: number;
  icon: LucideIcon;
  variant: 'success' | 'destructive' | 'warning' | 'default';
  delay?: number;
  compact?: boolean;
  onClick?: () => void;    // novo
  active?: boolean;        // novo
}
```

Quando `active` for true, adicionar classe `ring-2 ring-offset-1` com cor do variant correspondente. Quando `onClick` existir, o wrapper vira `cursor-pointer hover:scale-[1.02] transition-transform`.

### M365CVEsPage — stats baseados no total (nao filtrado)

Os stats devem ser calculados a partir de `data?.cves` (todos os CVEs retornados pelo backend, antes de filtros de produto/severidade/acao), para que os numeros nos cards reflitam o panorama completo e facam sentido como opcoes de filtro.

