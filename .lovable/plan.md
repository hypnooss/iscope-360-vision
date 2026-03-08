

## Plano: Galeria de avatares com estilos Anime e Super-heróis

### Contexto

DiceBear (API atual) não possui estilos anime/super-herói reais, e usar personagens Marvel/DC/anime reais viola copyright. A melhor abordagem é usar os estilos DiceBear que mais se aproximam dessas estéticas, combinados com labels atrativos e uma curadoria melhor.

### Alterações em `src/components/account/AvatarSelector.tsx`

**Substituir os estilos atuais por uma seleção mais diversa e temática:**

| Tab | Estilo DiceBear | Por quê |
|-----|----------------|---------|
| Anime | `adventurer` | Olhos grandes, traços estilo anime/manga |
| Cartoon | `avataaars` | Personagens cartoon coloridos, estética de herói |
| Fun | `fun-emoji` | Emojis 3D divertidos |
| Pixel | `pixel-art` | Estilo retro/gaming com cara de RPG |
| Cute | `big-ears` | Personagens fofinhos estilo chibi |
| Shapes | `shapes` | Geométrico/abstrato (o que o usuário aprovou) |

**Outras melhorias:**
- Aumentar seeds de 18 para 24 para mais variedade
- Manter grid responsivo sem scroll
- Manter randomização e seleção visual atual

