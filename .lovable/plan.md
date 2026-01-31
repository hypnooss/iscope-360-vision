

# Plano: Traduzir Severidade para Português

## Objetivo

Alterar a exibição do badge de severidade no ComplianceCard de inglês em maiúsculas para português com formatação adequada.

---

## Alteração Necessária

### Arquivo: `src/components/ComplianceCard.tsx`

### 1. Criar mapa de tradução de severidade

Adicionar um mapa para traduzir os valores de severidade do inglês para português:

```typescript
const severityLabels: Record<string, string> = {
  critical: 'Crítico',
  high: 'Alto',
  medium: 'Médio',
  low: 'Baixo',
  info: 'Info',
};
```

### 2. Remover classe `uppercase` e usar o mapa

**Linha 75-82 - Alterar de:**
```typescript
<span className={cn(
  "text-xs px-2 py-0.5 rounded-full font-medium uppercase", 
  normalizedStatus === 'pass' 
    ? (severityColorsPass[check.severity] || 'bg-muted text-muted-foreground')
    : (severityColorsFail[check.severity] || 'bg-muted text-muted-foreground')
)}>
  {check.severity}
</span>
```

**Para:**
```typescript
<span className={cn(
  "text-xs px-2 py-0.5 rounded-full font-medium", 
  normalizedStatus === 'pass' 
    ? (severityColorsPass[check.severity] || 'bg-muted text-muted-foreground')
    : (severityColorsFail[check.severity] || 'bg-muted text-muted-foreground')
)}>
  {severityLabels[check.severity] || check.severity}
</span>
```

Mudanças:
- Remover `uppercase` da classe CSS
- Substituir `{check.severity}` por `{severityLabels[check.severity] || check.severity}`

---

## Resultado Visual

| Antes | Depois |
|-------|--------|
| CRITICAL | Crítico |
| HIGH | Alto |
| MEDIUM | Médio |
| LOW | Baixo |
| INFO | Info |

---

## Arquivo a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/components/ComplianceCard.tsx` | Adicionar mapa de tradução e usar no badge |

