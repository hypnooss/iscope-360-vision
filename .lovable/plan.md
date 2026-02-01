

## Nova Página: Administração > Templates

### Objetivo
Criar uma nova página "Templates" no menu de Administração que lista os device_types (agora chamados de "Templates") existentes no sistema. Acesso restrito a **Super Admins** e **Super Suportes**.

---

### Dados Existentes

A tabela `device_types` já contém os templates:

| Vendor | Name | Code |
|--------|------|------|
| Fortinet | FortiGate | fortigate |
| SonicWall | SonicWall | sonicwall |
| iScope | Domínio Externo | external_domain |

---

### Arquivos a Criar/Modificar

#### 1. Criar nova página: `src/pages/admin/TemplatesPage.tsx`

Página simples que:
- Lista todos os templates da tabela `device_types`
- Exibe em formato de cards ou tabela (cards recomendado)
- Mostra: Vendor, Nome, Código, Categoria, Status (ativo/inativo)
- Apenas visualização (sem CRUD por enquanto)

Estrutura visual:
```
┌────────────────────────────────────────────────────────────────┐
│  TEMPLATES                                                      │
│  Gerencie os templates de dispositivos disponíveis no sistema  │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────┐  ┌─────────────────────────────┐  │
│  │  🔶 FortiGate           │  │  🔶 SonicWall               │  │
│  │  Fortinet               │  │  SonicWall                  │  │
│  │  Código: fortigate      │  │  Código: sonicwall          │  │
│  │  Categoria: Firewall    │  │  Categoria: Firewall        │  │
│  │  [Ativo]                │  │  [Ativo]                    │  │
│  └─────────────────────────┘  └─────────────────────────────┘  │
│                                                                 │
│  ┌─────────────────────────┐                                   │
│  │  🌐 Domínio Externo     │                                   │
│  │  iScope                 │                                   │
│  │  Código: external_domain│                                   │
│  │  Categoria: Outros      │                                   │
│  │  [Ativo]                │                                   │
│  └─────────────────────────┘                                   │
└────────────────────────────────────────────────────────────────┘
```

#### 2. Modificar: `src/components/layout/AppLayout.tsx`

**Linha 186**: Adicionar rota `/templates` à condição de expand do admin menu
```typescript
if (path === '/workspaces' || path === '/administrators' || path === '/settings' || path === '/collections' || path === '/templates') {
```

**Linha 363**: Adicionar rota `/templates` à verificação de rota ativa
```typescript
const isAdminRoute = location.pathname === '/workspaces' || ... || location.pathname === '/templates';
```

**Linhas 410-465**: Adicionar link "Templates" no menu de Administração (após Coletas):
```typescript
<Link
  to="/templates"
  onClick={() => setMobileMenuOpen(false)}
  className={cn(
    'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
    location.pathname === '/templates'
      ? 'bg-warning/20 text-warning font-medium'
      : 'text-warning/80 hover:bg-warning/10'
  )}
>
  <Layers className="w-4 h-4" />
  Templates
</Link>
```

**Linha 511**: Modificar condição para incluir `super_suporte`:
```typescript
{(role === 'super_admin' || role === 'super_suporte') && <AdminButton />}
```

#### 3. Modificar: `src/App.tsx`

Adicionar a rota para a nova página:
```typescript
const TemplatesPage = lazy(() => import("./pages/admin/TemplatesPage"));

// Na seção de rotas Admin:
<Route path="/templates" element={<TemplatesPage />} />
```

---

### Controle de Acesso

A página verificará se o usuário tem role `super_admin` ou `super_suporte`:
```typescript
useEffect(() => {
  if (!authLoading && !user) {
    navigate('/auth');
  } else if (!authLoading && role !== 'super_admin' && role !== 'super_suporte') {
    navigate('/dashboard');
    toast.error('Acesso restrito a Super Administradores');
  }
}, [user, role, authLoading, navigate]);
```

---

### Resumo das Alterações

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `src/pages/admin/TemplatesPage.tsx` | Criar | Nova página listando templates |
| `src/components/layout/AppLayout.tsx` | Modificar | Adicionar link "Templates" no menu e permitir super_suporte |
| `src/App.tsx` | Modificar | Adicionar rota `/templates` |

---

### Resultado Esperado

1. **Menu atualizado**: "Administração > Templates" visível para Super Admins e Super Suportes
2. **Página funcional**: Lista os 3 templates existentes em cards visuais
3. **Consistência visual**: Segue o mesmo padrão das outras páginas admin

