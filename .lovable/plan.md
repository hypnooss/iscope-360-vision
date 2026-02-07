

# Tornar "itens afetados" visivelmente clicavel nos cards de Postura M365

## Problema
O botao "X item(ns) afetado(s)" ja existe no codigo (`M365InsightCard.tsx`, linhas 119-128), mas visualmente parece texto estatico. O usuario nao percebe que pode clicar porque nao ha indicacao visual suficiente (sublinhado, cor diferente, icone de clique).

## Solucao

Melhorar a aparencia do indicador de itens afetados para tornar claro que e um elemento interativo, adicionando:
- Sublinhado permanente (nao apenas no hover)
- Cor mais destacada (ex: `text-foreground` em vez de `text-muted-foreground`)
- Icone de seta ou chevron indicando acao
- Estilo de "link" ao inves de texto passivo

## Arquivo a Modificar

| Arquivo | Mudanca |
|---------|---------|
| `src/components/m365/posture/M365InsightCard.tsx` | Alterar estilo do botao de "itens afetados" para parecer um link clicavel |

## Detalhes Tecnicos

Na linha 120-127 do `M365InsightCard.tsx`, alterar o `<button>` de:

```tsx
<button
  type="button"
  className="flex items-center gap-2 text-sm text-muted-foreground mb-3 hover:text-foreground transition-colors cursor-pointer group"
  onClick={() => setShowAffected(true)}
>
  <Users className="w-4 h-4" />
  <span className="group-hover:underline">...</span>
</button>
```

Para um estilo mais explicito com sublinhado permanente, cor de link e icone de chevron:

```tsx
<button
  type="button"
  className="flex items-center gap-2 text-sm text-amber-400 mb-3 hover:text-amber-300 transition-colors cursor-pointer underline underline-offset-2"
  onClick={() => setShowAffected(true)}
>
  <Users className="w-4 h-4" />
  <span>{insight.affectedCount} {insight.affectedCount === 1 ? 'item afetado' : 'itens afetados'}</span>
  <ChevronRight className="w-3.5 h-3.5" />
</button>
```

Isso garante que:
1. O texto tenha sublinhado permanente (como um link)
2. Use cor `amber-400` que se destaca do texto normal cinza
3. Tenha um icone de seta indicando que ha mais conteudo
4. O cursor pointer ja existe e continuara funcionando
