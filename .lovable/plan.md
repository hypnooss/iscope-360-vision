

# Adicionar Stats Cards e Campo de Busca na tela Compliance

## O que sera feito

Alinhar a tela Compliance com o padrao visual da tela Dominios Externos, adicionando os dois elementos que faltam:

### 1. Stats Cards

Adicionar uma grade de 4 cards de metricas entre o header e os filtros, calculados a partir dos dados ja carregados:

| Card | Icone | Metrica |
|---|---|---|
| Dominios | Globe | Total de dominios unicos com analises |
| Score Medio | TrendingUp | Media dos scores mais recentes por dominio |
| Alertas Criticos | AlertTriangle | Dominios com score abaixo de 50 |
| Falhas Criticas | Shield | Dominios com score abaixo de 30 |

Estilo identico ao da tela Dominios Externos: `Card > CardContent className="p-4"` com icone colorido e texto.

### 2. Campo de Busca

Adicionar um `Input` com icone `Search` antes dos filtros Select, permitindo buscar por nome de dominio ou cliente. Seguindo o padrao: `relative flex-1 max-w-sm` com icone posicionado a esquerda.

## Detalhes tecnicos

### Arquivo: `src/pages/external-domain/ExternalDomainReportsPage.tsx`

**Imports a adicionar**: `Input`, `Search`, `TrendingUp`, `Shield` (os demais ja existem ou serao usados dos imports atuais).

**Stats (useMemo)**: Calcular `total`, `avg`, `critical`, `failures` a partir de `groupedDomains`, usando o score da analise mais recente de cada dominio.

**Busca (useState + useMemo)**: Adicionar estado `search` e filtrar `groupedDomains` por `domain_url` ou `client_name`.

**Ordem dos blocos no JSX**:
1. Breadcrumb
2. Header responsivo (ja existe)
3. Stats Cards (novo - grid 4 colunas)
4. Busca + Filtros Select (busca nova, selects existentes)
5. Tabela em Card (ja existe)

