
## Plano: Menu Accordion Exclusivo (Estilo Zabbix)

### Objetivo

Implementar comportamento onde apenas um menu (módulo ou administração) fica expandido por vez. Ao clicar em outro, os demais fecham automaticamente.

---

### Alterações em `src/components/layout/AppLayout.tsx`

#### 1. Modificar `toggleModule` para Fechar os Demais

**Antes:**
```typescript
const toggleModule = (moduleCode: string) => {
  setExpandedModules(prev => ({
    ...prev,
    [moduleCode]: !prev[moduleCode],
  }));
};
```

**Depois:**
```typescript
const toggleModule = (moduleCode: string) => {
  setExpandedModules(prev => {
    const isCurrentlyOpen = prev[moduleCode];
    // Fecha todos e abre apenas o clicado (se estava fechado)
    return {
      [moduleCode]: !isCurrentlyOpen,
    };
  });
  // Fecha o menu de administração quando um módulo é aberto
  if (!expandedModules[moduleCode]) {
    setAdminMenuOpen(false);
  }
};
```

#### 2. Modificar Comportamento do Menu de Administração

Atualizar o `onOpenChange` do `Collapsible` de administração para fechar os módulos quando administração é aberta:

**No `AdminButton` (linha 388-390):**
```typescript
<Collapsible
  open={adminMenuOpen}
  onOpenChange={(open) => {
    setAdminMenuOpen(open);
    // Se estiver abrindo, fecha todos os módulos
    if (open) {
      setExpandedModules({});
    }
  }}
>
```

#### 3. Atualizar `useEffect` de Detecção de Rota

Garantir que ao navegar, apenas o módulo correspondente fique aberto:

**Antes (linhas 166-189):**
```typescript
if (path.startsWith('/scope-firewall')) {
  setActiveModule('scope_firewall');
  setExpandedModules(prev => ({ ...prev, scope_firewall: true }));
}
```

**Depois:**
```typescript
if (path.startsWith('/scope-firewall')) {
  setActiveModule('scope_firewall');
  setExpandedModules({ scope_firewall: true }); // Substitui tudo
  setAdminMenuOpen(false);
}
```

---

### Resumo do Comportamento

| Ação do Usuário | Resultado |
|-----------------|-----------|
| Clica em "Firewall" | Abre Firewall, fecha todos os outros |
| Clica em "Domínio Externo" | Abre Domínio Externo, fecha Firewall |
| Clica em "Administração" | Abre Administração, fecha todos os módulos |
| Navega para rota `/scope-firewall/*` | Apenas Firewall fica aberto |

---

### Arquivos Modificados

| Arquivo | Alteração |
|---------|-----------|
| `src/components/layout/AppLayout.tsx` | Lógica de accordion exclusivo |
