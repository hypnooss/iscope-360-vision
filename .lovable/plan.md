

# Plano: Adicionar Borda Verde em Todos os Campos de Evidência

## Objetivo

Padronizar a exibição de TODAS as evidências coletadas com a borda verde à esquerda (`border-l-2 border-primary`) e garantir separação visual clara quando há múltiplos valores.

## Alterações no Arquivo

### `src/components/compliance/EvidenceDisplay.tsx`

#### 1. Tratamento de Nameservers (linhas 317-326)

Adicionar borda verde em cada nameserver:

```typescript
// ANTES
<div key={idx} className="flex flex-col">

// DEPOIS
<div key={idx} className="border-l-2 border-primary/30 pl-3 flex flex-col">
```

#### 2. Tratamento de Arrays de Strings (linhas 336-344)

Adicionar borda verde em cada item:

```typescript
// ANTES
<div key={idx} className="flex flex-col">

// DEPOIS
<div key={idx} className="border-l-2 border-primary/30 pl-3 flex flex-col">
```

#### 3. Tratamento de Listas com Vírgula (linhas 417-426)

Adicionar borda verde em cada valor da lista:

```typescript
// ANTES
<div key={idx} className="flex flex-col">

// DEPOIS
<div key={idx} className="border-l-2 border-primary/30 pl-3 flex flex-col">
```

#### 4. Renderização Padrão de Texto Simples (linhas 435-440)

Adicionar borda verde no container:

```typescript
// ANTES
<div className="bg-muted/30 rounded-md p-3 border border-border/30">
  <span className="text-xs font-medium text-muted-foreground block mb-1">...</span>
  <p className="text-sm text-foreground">...</p>
</div>

// DEPOIS
<div className="bg-muted/30 rounded-md p-3 border border-border/30">
  <div className="border-l-2 border-primary/30 pl-3">
    <span className="text-xs font-medium text-muted-foreground block mb-1">...</span>
    <p className="text-sm text-foreground">...</p>
  </div>
</div>
```

#### 5. Fallback de Código (linhas 371-378)

Adicionar borda verde:

```typescript
// ANTES
<div className="bg-muted/30 rounded-md p-3 border border-border/30">
  <span>...</span>
  <code>...</code>
</div>

// DEPOIS
<div className="bg-muted/30 rounded-md p-3 border border-border/30">
  <div className="border-l-2 border-primary/30 pl-3">
    <span>...</span>
    <code>...</code>
  </div>
</div>
```

#### 6. Tratamento de Objeto Simples (linhas 361-368)

Adicionar borda verde no label antes do RecordDisplay:

```typescript
// ANTES
<span className="text-xs font-medium text-muted-foreground block">{item.label}</span>

// DEPOIS
<div className="border-l-2 border-primary/30 pl-3">
  <span className="text-xs font-medium text-muted-foreground block">{item.label}</span>
</div>
```

#### 7. Array de Objetos Genérico (linhas 348-357)

Adicionar borda no label:

```typescript
// ANTES  
<span className="text-xs font-medium text-muted-foreground block">{item.label}</span>

// DEPOIS
<div className="border-l-2 border-primary/30 pl-3 mb-2">
  <span className="text-xs font-medium text-muted-foreground block">{item.label}</span>
</div>
```

---

## Resultado Visual Esperado

### Nameservers (ANTES)
```
Nameserver
ns77.domaincontrol.com

Nameserver
ns78.domaincontrol.com
```

### Nameservers (DEPOIS)
```
│ Nameserver
│ ns77.domaincontrol.com

│ Nameserver
│ ns78.domaincontrol.com
```

### Texto Simples (ANTES)
```
Alinhamento SPF
Relaxado (r)
```

### Texto Simples (DEPOIS)
```
│ Alinhamento SPF
│ Relaxado (r)
```

---

## Arquivo a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/components/compliance/EvidenceDisplay.tsx` | Adicionar `border-l-2 border-primary/30 pl-3` em todos os campos de evidência |

---

## Considerações Técnicas

1. **Consistência visual**: Todos os campos terão a mesma aparência com borda verde
2. **Separação de itens**: Quando há múltiplos valores (Nameservers, IPs), cada um terá sua própria borda
3. **Já implementado**: MX e DKIM já usam esse padrão - apenas estender para os outros casos
4. **Classe utilizada**: `border-l-2 border-primary/30 pl-3` (borda 2px, cor primária 30% opacidade, padding left)

