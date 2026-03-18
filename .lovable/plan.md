

## Problema

O `ScrollDownIndicator` nao aparece no Hero nem em secoes antes do Showcase por dois motivos:

1. **Hero**: O `Header` e `sticky top-0` com `h-[72px]`. Na carga da pagina, o `rect.top` do hero e `72px`, nao `0`. As duas condicoes falham: `abs(72) < 5` = false, `72 < 5` = false.

2. **Secoes intermediarias**: Sem `scroll-snap-type` no container, o scroll manual do usuario quase nunca para com `rect.top` proximo de 0. A tolerancia de 5px e insuficiente.

O Showcase funciona porque tem 400vh e aciona a condicao `fillsViewport` (rect.top negativo, rect.bottom > innerHeight).

## Solucao

Duas alteracoes em `src/components/landing/ScrollDownIndicator.tsx`:

**1. Relaxar a condicao `fillsViewport`**

Trocar:
```typescript
const fillsViewport = rect.top < ALIGNMENT_TOLERANCE && rect.bottom > window.innerHeight;
```
Por:
```typescript
const fillsViewport = rect.top < window.innerHeight * 0.15 && rect.bottom > window.innerHeight;
```

Isso permite `rect.top` ate ~128px (15% da viewport), cobrindo o offset do header (72px) com margem. O `rect.bottom > window.innerHeight` garante que a secao se estende alem da viewport, evitando falsos positivos com secoes que estao apenas "aparecendo" no topo.

**2. Aumentar `ALIGNMENT_TOLERANCE` de 5 para 15**

Isso melhora a deteccao para secoes que param perto do topo via scroll manual (mas nao exatamente em 0). Valor conservador o suficiente para nao dar falso positivo entre secoes.

### Verificacao de edge cases

| Cenario | rect.top | rect.bottom | Resultado |
|---|---|---|---|
| Hero no load (header 72px) | 72 | ~928 | fillsViewport: 72 < 128 ✓, 928 > 856 ✓ → VISIVEL |
| Scroll entre secoes | -400 | 300 | fillsViewport: 300 > 856 ✗ → OCULTO |
| Secao alinhada via scrollIntoView | ~0 | ~920 | alignedTop: abs(0) < 15 ✓ → VISIVEL |
| Secao quase alinhada manual | 12 | ~900 | alignedTop: abs(12) < 15 ✓ → VISIVEL |

### Arquivo: `src/components/landing/ScrollDownIndicator.tsx`
- Linha 3: `ALIGNMENT_TOLERANCE = 5` → `15`
- Linha 15: condicao `fillsViewport` atualizada

