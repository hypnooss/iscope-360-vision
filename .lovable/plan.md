

# Ajustes de Grid e Labels no Dashboard

## 1. Grid dos Module Health Cards: maximo 3 por linha

Alterar a logica de `gridCols` (linha 253-257) para que o maximo seja `lg:grid-cols-3`. Quando houver 4+ modulos, o grid continua com 3 colunas e os extras vao para a proxima linha.

**Antes:**
```
moduleCards.length >= 4 → grid-cols-1 md:grid-cols-2 lg:grid-cols-4
```

**Depois:**
```
grid-cols-1 md:grid-cols-2 lg:grid-cols-3 (sempre, para 3+ modulos)
```

## 2. Grid do Card Infraestrutura: maximo 4 por linha

Alterar a logica de `infraGridCols` (linha 260-265) para limitar a 4 colunas. Quando houver 5+ itens (modulos + Agents), os extras vao para a proxima linha.

**Antes:** ja esta com `lg:grid-cols-4` para 4+, mas precisa garantir que nao ultrapasse 4.

**Depois:**
```
grid-cols-2 lg:grid-cols-4 (para qualquer quantidade >= 4)
```

A logica atual ja faz isso corretamente, mas sera simplificada para clareza.

## 3. Labels da Infraestrutura: usar nome do modulo

Na print, os textos "Firewalls", "Tenants M365", "Dominios" sao hardcoded via `infraLabel` do config. O usuario quer que reflitam o **nome do modulo** vindo do banco (campo `module.name`). Sera trocado `card.infraLabel` por `card.title` (que ja contem `um.module.name`).

## Alteracoes tecnicas

### Arquivo: `src/pages/GeneralDashboardPage.tsx`

| Linha | Alteracao |
|-------|-----------|
| 253-257 | `gridCols`: maximo `lg:grid-cols-3` |
| 260-265 | `infraGridCols`: simplificar para max 4 |
| 353 | Trocar `card.infraLabel` por `card.title` |

