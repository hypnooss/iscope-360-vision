

## Plano: Melhorar galeria de avatares + remover Status MFA

### Alterações

**1. `src/components/account/AvatarSelector.tsx`** — Substituir DiceBear por **Multiavatar API**

A API Multiavatar (`https://api.multiavatar.com/{seed}.svg`) gera avatares SVG coloridos com visual mais moderno, incluindo estilos que remetem a anime e cartoon. Em vez de 16 "estilos" fixos, gerar uma grade de ~20 avatares com seeds variados (baseados no nome do usuário + sufixos). O botão "Randomizar" troca todos os seeds de uma vez.

- URL base: `https://api.multiavatar.com/${seed}.svg`
- Seeds: combinações do nome do usuário com sufixos como `hero`, `ninja`, `cyber`, `dragon`, etc.
- Manter a mesma UX de galeria expansível com seleção e remoção

**2. `src/pages/AccountPage.tsx`** — Remover o bloco "Status MFA" da seção de informações read-only do card de Perfil (o MFA já tem seu próprio card dedicado à direita).

