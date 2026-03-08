

## Plano: Corrigir salvamento e exibição do avatar

### Problemas identificados

1. **Avatar não persiste após salvar**: O `handleSaveProfile` salva no banco mas não atualiza o `profile` no `AuthContext`. Além disso, o cache em `sessionStorage` mantém os dados antigos — na próxima carga, o perfil cacheado (sem avatar) é usado.

2. **Avatar não aparece no menu lateral**: O componente `Avatar` no rodapé do `AppLayout.tsx` (linha 839-843) só renderiza `AvatarFallback` com iniciais. Não há `AvatarImage` para exibir a URL do avatar quando ela existe.

### Alterações

**1. `src/contexts/AuthContext.tsx`** — Expor função `refreshProfile` no contexto
- Adicionar método `refreshProfile()` que busca o perfil do banco, atualiza o state e invalida o cache do `sessionStorage`
- Exportar no `AuthContextType`

**2. `src/pages/AccountPage.tsx`** — Chamar `refreshProfile` após salvar
- Após o `supabase.from('profiles').update(...)` com sucesso, chamar `refreshProfile()` para que o AuthContext e o cache reflitam o avatar salvo

**3. `src/components/layout/AppLayout.tsx`** — Exibir avatar no menu
- Importar `AvatarImage` do Radix
- Na linha ~839, adicionar `<AvatarImage src={effectiveProfile?.avatar_url} />` antes do `AvatarFallback`, para que o avatar seja exibido quando houver URL (o Radix fallback cuida automaticamente do caso sem imagem)

