

# Mapa de Ataques: Fullscreen com Animacoes Melhoradas

## Resumo

Transformar o mapa de ataques em um botao no dashboard que abre uma visualizacao fullscreen imersiva, inspirada nos mapas da SonicWall e FortiGuard. Inclui animacoes de "projeteis" viajando dos atacantes ao firewall e painel de estatisticas overlay.

## Mudancas visuais principais

### 1. Dashboard: Substituir card do mapa por botao

O card atual do "Mapa de Ataques" sera substituido por um botao compacto com preview miniatura do mapa, que ao clicar abre a tela fullscreen.

### 2. Tela Fullscreen do Mapa

- Fundo preto total (como SonicWall)
- Mapa ocupa toda a tela
- Botao "Voltar" no canto superior esquerdo
- Legenda e estatisticas em overlay semitransparente na parte inferior
- Painel lateral com Top 3 paises atacantes (como FortiGuard/SonicWall)

### 3. Animacoes melhoradas (inspiradas em SonicWall)

Em vez de linhas tracejadas estaticas, implementar "projeteis" animados:
- Pequenos circulos brilhantes que viajam do pais atacante ate o firewall
- Cada tipo de ataque tem cor diferente (vermelho, laranja, verde)
- Os projeteis aparecem em intervalos alternados (efeito de fluxo continuo)
- Ao chegar no firewall, um flash de impacto pulsa brevemente
- Pontos de origem pulsam com glow mais intenso

## Detalhes tecnicos

### Arquivo: `src/components/firewall/AttackMap.tsx`

Refatorar completamente para suportar dois modos: `inline` (preview miniatura) e `fullscreen`.

Principais mudancas:
- Nova prop `fullscreen?: boolean` que controla o layout
- Substituir linhas tracejadas por animacao de projeteis usando `<circle>` com `<animateMotion>` ao longo de `<path>` reto entre atacante e firewall
- Cada projetil e um circulo pequeno (r=2-3) com glow filter SVG
- Multiplos projeteis por linha com `begin` offset diferente para efeito continuo
- Flash de impacto: circulo no ponto do firewall que pulsa brevemente quando projetil "chega"
- SVG filter `<feGaussianBlur>` para efeito neon/glow nos projeteis
- Em modo fullscreen: viewBox maior, fundo preto, sem border radius

### Arquivo: `src/components/firewall/AttackMapFullscreen.tsx` (NOVO)

Componente wrapper fullscreen:
- `position: fixed inset-0 z-50` com fundo preto
- Botao "Voltar" (icone ArrowLeft + texto) no canto superior esquerdo
- Renderiza `<AttackMap fullscreen />` ocupando toda a tela
- Painel overlay inferior com legenda e contadores totais
- Painel lateral direito com Top 3 paises atacantes (bandeira + contagem)
- Animacao de entrada (fade-in)

### Arquivo: `src/pages/firewall/AnalyzerDashboardPage.tsx`

Substituir o card do mapa (linhas 493-511) por:
- Um botao/card clicavel com preview miniatura do mapa
- Estado `showAttackMap` que controla visibilidade do fullscreen
- Renderizar `<AttackMapFullscreen>` condicionalmente

### Animacao de projeteis (detalhe tecnico)

```text
Atacante (ponto)  ----[projetil]----->  Firewall (shield)
     |                                      |
   pulse                              flash on impact
```

Para cada linha atacante-firewall:
- Criar `<path>` invisivel (stroke="none") entre os dois pontos
- 3 projeteis `<circle>` com `<animateMotion>` seguindo esse path
- `dur="2s"` com `begin="0s"`, `begin="0.7s"`, `begin="1.4s"` (escalonados)
- Projeteis tem `fill` da cor do tipo + SVG glow filter
- `repeatCount="indefinite"` para loop continuo

### Overlay de estatisticas (parte inferior)

Barra semitransparente na base da tela com:
- Total de eventos por tipo (Negado, Auth Falha, Auth Sucesso)
- Nome do firewall selecionado
- Data da ultima analise

### Painel lateral (lado direito)

Coluna semitransparente com:
- "Top 3 Origens de Ataque" com bandeira do pais e contagem
- "Top 3 IPs Bloqueados" com IP e contagem

### Resumo de arquivos

| Arquivo | Acao |
|---------|------|
| `AttackMap.tsx` | Refatorar: adicionar modo fullscreen, projeteis animados com glow |
| `AttackMapFullscreen.tsx` | Novo: wrapper fullscreen com overlays e botao voltar |
| `AnalyzerDashboardPage.tsx` | Trocar card do mapa por botao que abre fullscreen |

