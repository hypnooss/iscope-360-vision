
# Efeito Glass nos Cards de Saude dos Ativos

## Problema
Os cards estao visualmente "amontoados" - todos compartilham o mesmo fundo escuro generico (`bg-card/50`) com apenas a borda esquerda colorida, tornando dificil distinguir rapidamente um card do outro.

## Solucao
Aplicar a cor da severidade de forma mais abrangente em cada card, criando um efeito "glass" sutil:

1. **Background tintado**: usar a cor da severidade como fundo com baixa opacidade (ex: `bg-red-500/5` para critical)
2. **Bordas coloridas em todas as direcoes**: substituir `border-border/40` pela cor da severidade com transparencia (ex: `border-red-500/20`)
3. **Hover com intensidade levemente maior** no background

## Detalhes tecnicos

**Arquivo**: `src/components/surface/AssetHealthGrid.tsx`

### Substituir `BORDER_COLORS` por `CARD_STYLES`
Trocar o mapa simples de cores de borda por um mapa completo de estilos por severidade:

```text
CARD_STYLES = {
  critical: {
    border-l: border-l-red-500
    border:   border-red-500/20
    bg:       bg-red-500/5
    hover:    hover:bg-red-500/10
  },
  high: {
    border-l: border-l-orange-500
    border:   border-orange-500/20
    bg:       bg-orange-500/5
    hover:    hover:bg-orange-500/10
  },
  medium: {
    border-l: border-l-yellow-500
    border:   border-yellow-500/20
    bg:       bg-yellow-500/5
    hover:    hover:bg-yellow-500/10
  },
  low: {
    border-l: border-l-blue-400
    border:   border-blue-400/20
    bg:       bg-blue-400/5
    hover:    hover:bg-blue-400/10
  },
  ok: {
    border-l: border-l-emerald-500
    border:   border-emerald-500/20
    bg:       bg-emerald-500/5
    hover:    hover:bg-emerald-500/10
  }
}
```

### Atualizar os cards (ok e com achados)
Substituir as classes atuais:
- De: `border border-border/40 bg-card/50 ... hover:bg-muted/30`
- Para: `border ${style.border} ${style.bg} ... ${style.hover} border-l-4 ${style.borderL}`

Isso cria uma "aura" visual em cada card que comunica a severidade imediatamente, com o efeito glass vindo da combinacao de fundo semi-transparente colorido com bordas suaves na mesma tonalidade.
