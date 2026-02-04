

## Corrigir Inconsistência de Versões entre Telas de Agents

### Diagnóstico

Analisei o banco de dados e o código das duas telas:

**Dados atuais no banco:**
| Agent | Versão Atual | Status |
|-------|-------------|--------|
| ESTRELA-ITP | 1.0.0 | Desatualizado |
| ESTRELA-SAO | 1.1.1 | Atualizado |
| Todos outros | 1.1.1 | Atualizados |

**Causa raiz identificada:** As telas não possuem **auto-refresh** nem **real-time subscription**. Quando os agents enviam heartbeat e atualizam suas versões, as telas permanecem com dados antigos até que o usuario clique em refresh ou navegue novamente.

No momento dos screenshots:
- Ambas as telas estavam mostrando dados de momentos diferentes
- Os agents estavam em processo de atualização (os dados mudaram entre as consultas)

---

### Solucao Proposta

Implementar **polling automatico** nas duas telas para manter os dados sincronizados:

#### 1. AgentsPage.tsx - Adicionar auto-refresh

```typescript
// Adicionar polling a cada 5 segundos para manter dados atualizados
useEffect(() => {
  if (user && canAccessPage) {
    fetchData();
    
    // Polling every 5 seconds
    const interval = setInterval(() => {
      fetchData();
    }, 5000);
    
    return () => clearInterval(interval);
  }
}, [user, canAccessPage]);
```

#### 2. SettingsPage.tsx - Adicionar auto-refresh para stats

```typescript
// Adicionar polling para stats de agents na aba de updates
useEffect(() => {
  if (user && role === 'super_admin') {
    loadAgentStats();
    
    // Polling every 5 seconds when on the agents tab
    const interval = setInterval(() => {
      loadAgentStats();
    }, 5000);
    
    return () => clearInterval(interval);
  }
}, [user, role]);
```

---

### Alternativa: Real-time com Supabase

Uma solucao mais elegante seria usar Supabase Realtime:

```typescript
useEffect(() => {
  const channel = supabase
    .channel('agents-changes')
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'agents' },
      (payload) => {
        // Atualizar apenas o agent que mudou
        setAgents(prev => prev.map(a => 
          a.id === payload.new.id 
            ? { ...a, ...payload.new }
            : a
        ));
      }
    )
    .subscribe();

  return () => { supabase.removeChannel(channel); };
}, []);
```

---

### Arquivos a Modificar

| Arquivo | Alteracao |
|---------|-----------|
| `src/pages/AgentsPage.tsx` | Adicionar polling de 5s no useEffect |
| `src/pages/admin/SettingsPage.tsx` | Adicionar polling de 5s para loadAgentStats |

---

### Consideracoes

1. **Performance**: Polling de 5s e leve (apenas SELECT dos agents)
2. **Consistencia**: Ambas as telas mostrarao os mesmos dados
3. **UX**: O botao de refresh manual pode ser mantido para forcas atualizacao imediata

