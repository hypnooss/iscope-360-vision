

# Plano de Correção: Erro 401 "Invalid Token" Intermitente

## Diagnóstico

O erro ocorre quando o token JWT enviado para a edge function `get-m365-config` está associado a uma sessão que já não existe mais no servidor (foi feito logout ou a sessão expirou).

```text
┌─────────────────┐      Token antigo       ┌──────────────────┐
│    Frontend     │ ────────────────────►   │   Edge Function  │
│  (token em cache)│                        │ getUser(token)   │
└─────────────────┘                         └────────┬─────────┘
                                                     │
                                                     ▼
                                            ┌──────────────────┐
                                            │  Supabase Auth   │
                                            │ "Session not     │
                                            │  found" (403)    │
                                            └──────────────────┘
```

## Solução

### 1. Melhorar tratamento de erro na Edge Function

Usar `getClaims()` em vez de `getUser()` para validação mais leve, com melhor logging para diagnóstico.

**Arquivo:** `supabase/functions/get-m365-config/index.ts`

```typescript
// Trocar getUser por getClaims (mais eficiente)
const { data: claims, error: authError } = await supabase.auth.getClaims(token);

if (authError || !claims?.claims?.sub) {
  console.error('Token validation failed:', authError?.message);
  return new Response(
    JSON.stringify({ 
      error: 'Invalid or expired token',
      code: 'TOKEN_INVALID' 
    }),
    { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

const userId = claims.claims.sub;
```

### 2. Adicionar tratamento de sessão expirada no Frontend

**Arquivo:** `src/pages/admin/SettingsPage.tsx`

Melhorar o `checkM365Config` para detectar erros 401 e atualizar a sessão:

```typescript
const checkM365Config = async () => {
  try {
    setLoading(true);
    
    // Verificar se a sessão ainda é válida antes de chamar
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate('/auth');
      return;
    }
    
    const { data, error } = await supabase.functions.invoke('get-m365-config');
    
    if (error) {
      // Se for erro de autenticação, tentar refresh da sessão
      if (error.message?.includes('401') || error.message?.includes('Invalid token')) {
        const { error: refreshError } = await supabase.auth.refreshSession();
        if (refreshError) {
          toast.error('Sessão expirada. Por favor, faça login novamente.');
          navigate('/auth');
          return;
        }
        // Tentar novamente após refresh
        const { data: retryData, error: retryError } = 
          await supabase.functions.invoke('get-m365-config');
        if (!retryError && retryData) {
          // Processar dados...
        }
      }
      // ... resto do tratamento
    }
  } catch (error) {
    // ...
  }
};
```

### 3. Adicionar listener global de autenticação

**Arquivo:** `src/contexts/AuthContext.tsx`

Garantir que mudanças de sessão invalidem dados em cache:

```typescript
useEffect(() => {
  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    async (event, session) => {
      if (event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED') {
        // Limpar qualquer estado em cache que dependa do token
      }
      // ... resto da lógica existente
    }
  );
  return () => subscription.unsubscribe();
}, []);
```

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/get-m365-config/index.ts` | Usar `getClaims()`, melhor logging |
| `src/pages/admin/SettingsPage.tsx` | Retry com refresh de sessão |
| `src/contexts/AuthContext.tsx` | Verificar se já tem tratamento adequado |

## Resultado Esperado

- Erros 401 intermitentes serão tratados automaticamente com refresh de sessão
- Se a sessão não puder ser recuperada, o usuário será redirecionado para login
- Melhor logging para diagnóstico futuro

