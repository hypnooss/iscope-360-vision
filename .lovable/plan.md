
# Melhoria Visual do WAN Selector Dialog

## Situação atual

O dialog exibe os cards de IP WAN com um layout funcional porém básico:
- Fundo `bg-muted/20` plano sem profundidade
- Interface (`wan1`, `wan2`) em fonte mono pequena sem destaque
- IP, Local e Coords listados com texto simples em `text-sm`
- Botão "Selecionar" padrão sem diferenciação visual
- Sem separação visual entre o nome da interface e os detalhes
- Coordenadas visíveis mas irrelevantes para o usuário final

## Melhorias propostas

### Layout geral do Dialog
- Aumentar para `max-w-md` com padding mais generoso
- Adicionar ícone `MapPin` no título para contexto visual imediato

### Cards de cada IP WAN
Redesenho completo de cada card com 3 zonas:

```
┌─────────────────────────────────────────────┐
│  🇧🇷  wan1  ·  Interface WAN                 │   ← header do card com badge
│─────────────────────────────────────────────│
│  🖧  186.233.96.14                           │   ← IP destacado
│  📍 Palmas, Tocantins, Brazil               │   ← localização
│─────────────────────────────────────────────│
│                          [✓ Selecionar]      │   ← botão no footer
└─────────────────────────────────────────────┘
```

**Header do card:**
- Background `bg-muted/30` com `border-b border-border/50`
- Bandeira grande (`text-2xl`) + nome da interface em `font-semibold` + badge `WAN` com cor `teal`
- Padding `px-4 py-3`

**Body do card:**
- IP com ícone `Globe` e tamanho maior (`text-base font-mono font-bold`)
- Localização com ícone `MapPin` em `text-muted-foreground`
- **Remover as coordenadas** — são irrelevantes para o usuário

**Footer do card:**
- Fundo ligeiramente diferente (`bg-muted/10`)
- Botão `Selecionar` com ícone `Check`, variante `default`, tamanho `sm`, alinhado à direita
- Hover: borda do card fica `border-primary/50` (indicação visual de seleção)

### Estados de hover
- `group` no card root
- `group-hover:border-primary/40 group-hover:bg-muted/30` no card

## Arquivo a modificar

| Arquivo | Linhas | Operação |
|---|---|---|
| `src/pages/environment/AddFirewallPage.tsx` | 1113–1164 | Redesenho completo do WAN Selector Dialog |

## Resultado esperado

Um dialog limpo, moderno e legível com:
- Hierarquia visual clara: interface → IP → localização
- Cards com cabeçalho destacado, seção de dados e ação bem separados
- Coordenadas removidas (ruído para o usuário)
- Hover interativo que indica qual card está sendo considerado
