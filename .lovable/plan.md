

## Paginação de Subdomínios no Mapa DNS

### Problema

Com 55 subdomínios ativos, a coluna fica muito longa e estranha visualmente. Atualmente, todos os subdomínios são renderizados de uma vez (linhas 609-622).

### Solução

Implementar paginação progressiva com limite de 10 itens por vez e botão "Exibir mais".

---

### Alterações Técnicas

**Arquivo:** `src/components/external-domain/DNSMapSection.tsx`

#### 1. Adicionar estado para controle de paginação

```typescript
// Linha ~285, junto com o state de subdomainFilter
const [subdomainVisibleCount, setSubdomainVisibleCount] = useState(10);
```

#### 2. Criar lista paginada de subdomínios

```typescript
// Após filteredSubdomains (linha ~305)
const visibleSubdomains = filteredSubdomains.slice(0, subdomainVisibleCount);
const hasMoreSubdomains = subdomainVisibleCount < filteredSubdomains.length;
```

#### 3. Reset da paginação ao mudar filtro

Atualizar o `useMemo` do `filteredSubdomains` para resetar a contagem quando o filtro mudar:

```typescript
// Adicionar useEffect para resetar paginação quando filtro muda
useEffect(() => {
  setSubdomainVisibleCount(10);
}, [subdomainFilter]);
```

#### 4. Atualizar renderização (linhas 609-627)

**Antes:**
```tsx
{filteredSubdomains.length > 0 ? (
  filteredSubdomains.map((sub, idx) => (
    <DNSNode ... />
  ))
) : (...)}
```

**Depois:**
```tsx
{filteredSubdomains.length > 0 ? (
  <>
    {visibleSubdomains.map((sub, idx) => (
      <DNSNode 
        key={idx} 
        label={sub.subdomain}
        sublabel={sub.addresses.length > 0 
          ? sub.addresses.slice(0, 2).map(a => a.ip).join(', ')
          : undefined
        }
        isActive={sub.is_alive}
        showCopy 
        showExternalLink={sub.is_alive}
      />
    ))}
    
    {/* Botão Exibir Mais */}
    {hasMoreSubdomains && (
      <Button
        variant="ghost"
        size="sm"
        className="w-full mt-2 text-xs text-muted-foreground hover:text-foreground"
        onClick={() => setSubdomainVisibleCount(prev => prev + 10)}
      >
        Exibir mais ({subdomainVisibleCount} de {filteredSubdomains.length})
      </Button>
    )}
  </>
) : (
  <div className="text-[13px] text-muted-foreground text-center py-2">
    Nenhum subdomínio encontrado
  </div>
)}
```

---

### Comportamento

| Ação | Resultado |
|------|-----------|
| Página inicial | Exibe 10 subdomínios |
| Clique em "Exibir mais" | Mostra +10 (total: 20) |
| Continuar clicando | Incrementa 10 até exibir todos |
| Mudar filtro (ativos/inativos) | Reseta para 10 |

---

### Arquivo Modificado

- `src/components/external-domain/DNSMapSection.tsx`

