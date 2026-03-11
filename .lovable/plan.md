

## Plano: Adicionar seletor de fuso horário na conta do usuário

### Mudanças

1. **Migration SQL**: Adicionar coluna `timezone` na tabela `profiles`
   - `ALTER TABLE profiles ADD COLUMN timezone text DEFAULT 'America/Sao_Paulo'`

2. **`src/contexts/AuthContext.tsx`**: Adicionar `timezone` ao `UserProfile` interface e incluí-lo no fetch do perfil

3. **`src/pages/AccountPage.tsx`**: Adicionar um `<Select>` abaixo do campo "Nome Completo" com os fusos horários brasileiros mais comuns e outros relevantes (America/Sao_Paulo, America/Manaus, America/Bahia, America/Fortaleza, America/Belem, America/Cuiaba, America/Rio_Branco, etc. + UTC e alguns internacionais). Salvar o valor junto com o `handleSaveProfile`.

4. **`src/lib/dateUtils.ts`**: (Futuro) Atualmente hardcoded como `America/Sao_Paulo`. Não alterar agora — apenas salvar a preferência. A integração com as funções de formatação pode ser feita em um próximo passo.

### Fusos disponíveis no seletor

| Valor | Label |
|---|---|
| America/Sao_Paulo | Brasília (BRT/BRST, UTC-3) |
| America/Fortaleza | Fortaleza (BRT, UTC-3) |
| America/Belem | Belém (BRT, UTC-3) |
| America/Manaus | Manaus (AMT, UTC-4) |
| America/Cuiaba | Cuiabá (AMT, UTC-4) |
| America/Rio_Branco | Rio Branco (ACT, UTC-5) |
| America/Noronha | Fernando de Noronha (FNT, UTC-2) |
| UTC | UTC |

