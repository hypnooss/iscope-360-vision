
# Plano: Corrigir Toggle e Espaçamento da Seção de Permissões

## Problemas Identificados

1. **Seção RBAC não oculta**: A seção "Roles do Diretório (RBAC)" (linhas 379-404) está **fora** do bloco `{showPermissions && (...)}` que termina na linha 377
2. **Espaçamento ruim**: Falta espaço adequado entre a última permissão (Policy.Read.All) e a linha horizontal divisória

## Alterações

### Arquivo: src/components/m365/TenantStatusCard.tsx

#### Reorganizar estrutura do JSX (linhas 351-405)

**Antes:**
```tsx
{showPermissions && (
  <div className="mt-3 space-y-4">
    <p className="text-xs text-muted-foreground">Permissões do Microsoft Graph</p>
    <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
      {/* ... PERMISSION_CATEGORIES ... */}
    </div>
  </div>
)}

{/* Directory Roles Section - FORA DO CONDICIONAL! */}
<div className="pt-4 border-t border-border/50">
  <p className="text-xs text-muted-foreground mb-3">Roles do Diretório (RBAC)</p>
  {/* ... DIRECTORY_ROLES ... */}
</div>
```

**Depois:**
```tsx
{showPermissions && (
  <div className="mt-4 space-y-6">
    {/* Graph Permissions */}
    <div>
      <p className="text-xs text-muted-foreground mb-3">Permissões do Microsoft Graph</p>
      <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
        {/* ... PERMISSION_CATEGORIES ... */}
      </div>
    </div>

    {/* Directory Roles Section - DENTRO DO CONDICIONAL */}
    <div className="pt-4 border-t border-border/50">
      <p className="text-xs text-muted-foreground mb-3">Roles do Diretório (RBAC)</p>
      <div className="grid gap-4 grid-cols-2">
        {/* ... DIRECTORY_ROLES ... */}
      </div>
    </div>
  </div>
)}
```

## Mudanças de Espaçamento

| Elemento | Antes | Depois |
|----------|-------|--------|
| Container principal | `mt-3 space-y-4` | `mt-4 space-y-6` |
| Título "Permissões do Microsoft Graph" | Sem margin bottom | `mb-3` |
| Seção RBAC | Fora do toggle | Dentro do toggle |

## Resultado

- A seta de toggle vai ocultar **ambas** as seções (Graph Permissions e Directory Roles)
- Espaçamento visual melhorado entre as seções
- Layout mais limpo e consistente
