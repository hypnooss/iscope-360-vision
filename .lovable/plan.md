

## Problema: Auto Refresh não funciona de verdade

### Causa raiz

No `useEffect` (linha 90-105), o intervalo de polling é criado **dentro** do bloco `if (!initialLoadDone.current)`. Quando o React limpa o efeito (por mudança de `user` ou `role`), o `clearInterval` roda, mas o intervalo **nunca é recriado** porque `initialLoadDone.current` já é `true`.

```text
1. Montagem → initialLoadDone = false → cria interval ✓
2. user/role muda → cleanup → clearInterval ✓
3. Re-executa effect → initialLoadDone = true → NÃO cria interval ✗
4. Polling morto para sempre
```

### Correção

**Arquivo:** `src/pages/admin/SettingsPage.tsx`

Separar o intervalo de polling em seu próprio `useEffect`, independente do `initialLoadDone`:

```js
// Effect 1: carga inicial (uma vez)
useEffect(() => {
  if (user && role === 'super_admin' && !initialLoadDone.current) {
    initialLoadDone.current = true;
    loadApiKeys();
    loadAgentSettings();
    loadAgentUpdateSettings();
    loadAgentStats();
    setLoading(false);
  }
}, [user, role]);

// Effect 2: polling contínuo (sempre ativo enquanto logado como super_admin)
useEffect(() => {
  if (!user || role !== 'super_admin') return;

  const interval = setInterval(() => {
    loadAgentStats();
  }, 5000);

  return () => clearInterval(interval);
}, [user, role]);
```

Isso garante que o intervalo de 5s **sempre** existe enquanto o super_admin estiver na página, independente de re-renders.

### Resultado esperado

Ao atualizar um Agent no servidor, o contador sobe de 6 para 7 em no máximo 5 segundos, sem precisar recarregar a página.

