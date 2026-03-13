

## Alterações na aba "Cobertura MFA" — Status Geral

### Mudanças no `EntraIdCategorySheet.tsx` (caso `mfa_coverage`):

**1. Renomear "MFA Habilitado" → "MFA Forte"** (linha 166)

**2. Atualizar os cards do Resumo MFA** (linhas 175-178):
- Substituir "Com MFA" / "Sem MFA" por 4 cards em grid 2x2:
  - **Membros Analisados** → `mfa.total`
  - **MFA Forte** → `strongUsers.length` (cor emerald)
  - **MFA Fraco** → `weakUsers.length` (cor amber)
  - **Sem MFA** → `disabledUsersDetail.length` (cor destructive)

**3. Atualizar a barra de progresso** (linhas 180-186):
- Substituir o `<Progress>` simples por um `<ProportionalBar>` com 3 segmentos:
  - MFA Forte → `bg-emerald-500`
  - MFA Fraco → `bg-amber-500`
  - Sem MFA → `bg-destructive`

Essas alterações usam valores já calculados (`strongUsers`, `weakUsers`, `disabledUsersDetail`) sem necessidade de mudança na Edge Function.

