

# Plano: Corrigir Badge de Criticidade nas Categorias

## Problema Identificado

O badge mostra "2 críticos" mas os itens são na verdade 2 de severidade "Alto" (high) e 1 "Médio" (medium). O código atual conta tanto `critical` quanto `high` mas usa o label "críticos", o que é incorreto.

---

## Solução

Separar a contagem de críticos e altos, ou ajustar o texto do badge para refletir corretamente o que está sendo contado.

### Opção Escolhida: Badge com Contagem Separada

Mostrar badges separados para cada nível de severidade quando houver falhas:
- Badge vermelho para críticos (se houver)
- Badge laranja para altos (se houver)

---

## Alterações

### Arquivo: `src/components/external-domain/ExternalDomainCategorySection.tsx`

### 1. Separar contagens por severidade

**Substituir (linhas 72-75):**
```typescript
// Count critical and high severity failures
const criticalHighCount = category.checks.filter(
  c => c.status === 'fail' && (c.severity === 'critical' || c.severity === 'high')
).length;
```

**Por:**
```typescript
// Count failures by severity
const criticalCount = category.checks.filter(
  c => c.status === 'fail' && c.severity === 'critical'
).length;

const highCount = category.checks.filter(
  c => c.status === 'fail' && c.severity === 'high'
).length;
```

### 2. Atualizar renderização dos badges

**Substituir (linhas 105-109):**
```typescript
{criticalHighCount > 0 && (
  <Badge className="bg-red-500/10 text-red-500 border-red-500/20 text-xs">
    {criticalHighCount} crítico{criticalHighCount !== 1 ? 's' : ''}
  </Badge>
)}
```

**Por:**
```typescript
{criticalCount > 0 && (
  <Badge className="bg-red-500/10 text-red-500 border-red-500/20 text-xs">
    {criticalCount} crítico{criticalCount !== 1 ? 's' : ''}
  </Badge>
)}
{highCount > 0 && (
  <Badge className="bg-orange-500/10 text-orange-500 border-orange-500/20 text-xs">
    {highCount} alto{highCount !== 1 ? 's' : ''}
  </Badge>
)}
```

---

## Resultado Visual

**Antes:**
```
[Segurança DNS]  [6 verificações]  [2 críticos]     50%
```

**Depois (exemplo com 0 críticos e 2 altos):**
```
[Segurança DNS]  [6 verificações]  [2 altos]        50%
```

**Ou se houver ambos:**
```
[Segurança DNS]  [6 verificações]  [1 crítico]  [2 altos]  50%
```

---

## Arquivo a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/components/external-domain/ExternalDomainCategorySection.tsx` | Separar contagem de críticos/altos e exibir badges corretos |

