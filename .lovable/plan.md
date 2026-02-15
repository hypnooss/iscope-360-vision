

# Paginacao e Busca Global na Pagina de CVEs

## Problema

A pagina `/cves` renderiza todas as CVEs filtradas de uma vez (potencialmente 1000+ cards), causando lentidao. Alem disso, a busca deve pesquisar em todas as CVEs, nao apenas nas exibidas na pagina atual.

## Solucao

Adicionar paginacao de 20 itens por pagina, mantendo a busca e filtros operando sobre o dataset completo.

### Arquivo: `src/pages/admin/CVEsCachePage.tsx`

### 1. Novo estado de paginacao

Adicionar estado `page` (comecando em 1) e constante `PAGE_SIZE = 20`. Resetar para pagina 1 sempre que `search`, `filterModule` ou `severityFilter` mudarem.

### 2. Separar `filtered` de `displayed`

- `filtered` continua operando sobre TODAS as CVEs (busca + filtros de modulo/severidade) -- sem mudanca
- Novo `displayed = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)` -- apenas os 20 da pagina atual
- Renderizar apenas `displayed` no map de CVECards

### 3. Controles de paginacao

Adicionar barra de paginacao abaixo da lista com:
- Botoes "Anterior" / "Proxima" (desabilitados nos limites)
- Indicador "Pagina X de Y"
- Total filtrado: "Mostrando 1-20 de 347 CVEs"

### 4. Texto informativo atualizado

Atualizar o texto "Mostrando X de Y" para refletir o range da pagina:
```
Mostrando 1-20 de 347 CVEs (total: 1023)
```

## Resumo

| Local | Mudanca |
|-------|---------|
| Estado `page` + `PAGE_SIZE` | Novo estado e constante |
| `useMemo` para `displayed` | Slice paginado do `filtered` |
| Reset de pagina | `useEffect` ao mudar filtros/busca |
| Controles de paginacao | Botoes Anterior/Proxima + indicador |
| Texto "Mostrando" | Range paginado + total |

