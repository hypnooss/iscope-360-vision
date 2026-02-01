

## Plano: Atualizar CategorySection para Padrão de Domínios Externos

### Objetivo

Atualizar o componente `CategorySection.tsx` (usado no relatório de Firewall) para seguir o mesmo padrão visual do `ExternalDomainCategorySection.tsx`:
- Remover textos "X verificações" e "aprovação"
- Adicionar badge com contagem de verificações
- Adicionar badges de severidades ativas (crítico, alto, médio, baixo)

---

### Comparação Visual

**Antes (CategorySection atual):**
```
┌─────────────────────────────────────────────────────────────────┐
│ [Icon] Nome da Categoria                           85%         │
│        12 verificações                          aprovação      │
│        Descrição longa da categoria...                         │
└─────────────────────────────────────────────────────────────────┘
```

**Depois (Novo padrão):**
```
┌─────────────────────────────────────────────────────────────────┐
│ [Icon] Nome da Categoria [12 verificações] [2 críticos] [1 alto]    85% │
└─────────────────────────────────────────────────────────────────────────┘
```

---

### Alterações em `src/components/CategorySection.tsx`

#### 1. Adicionar Import do Badge

```typescript
import { Badge } from '@/components/ui/badge';
```

#### 2. Adicionar Contadores de Severidade

Após a linha 55 (antes de `getPassRateColor`):

```typescript
// Count failures by severity (only active/failing items)
const criticalCount = category.checks.filter(
  c => c.status === 'fail' && c.severity === 'critical'
).length;

const highCount = category.checks.filter(
  c => c.status === 'fail' && c.severity === 'high'
).length;

const mediumCount = category.checks.filter(
  c => c.status === 'fail' && c.severity === 'medium'
).length;

const lowCount = category.checks.filter(
  c => c.status === 'fail' && c.severity === 'low'
).length;
```

#### 3. Substituir Bloco de Conteúdo Esquerdo

**Antes (linhas 72-93):**
```tsx
<div className="flex items-center gap-3">
  <div className="p-2 rounded-lg" style={{ backgroundColor: `${colorHex}15` }}>
    <DynamicIcon name={config.icon} className="w-5 h-5" style={{ color: colorHex }}/>
  </div>
  <div className="text-left">
    <h3 className="font-semibold text-foreground">{config.displayName}</h3>
    <p className="text-sm text-muted-foreground">
      {category.checks.length} verificações
    </p>
    {categoryDescriptions[category.name] && (
      <p className="text-xs text-muted-foreground/80 mt-1 max-w-xl">
        {categoryDescriptions[category.name]}
      </p>
    )}
  </div>
</div>
```

**Depois:**
```tsx
<div className="flex items-center gap-3 flex-wrap">
  <div className="p-2 rounded-lg" style={{ backgroundColor: `${colorHex}15` }}>
    <DynamicIcon name={config.icon} className="w-5 h-5" style={{ color: colorHex }}/>
  </div>
  <span className="font-semibold text-foreground">{config.displayName}</span>
  <Badge variant="secondary" className="text-xs">
    {category.checks.length} verificaç{category.checks.length !== 1 ? 'ões' : 'ão'}
  </Badge>
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
  {mediumCount > 0 && (
    <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20 text-xs">
      {mediumCount} médio{mediumCount !== 1 ? 's' : ''}
    </Badge>
  )}
  {lowCount > 0 && (
    <Badge className="bg-blue-400/10 text-blue-400 border-blue-400/20 text-xs">
      {lowCount} baixo{lowCount !== 1 ? 's' : ''}
    </Badge>
  )}
</div>
```

#### 4. Simplificar Bloco de Percentual

**Antes (linhas 96-118):**
```tsx
<div className="flex items-center gap-4">
  {category.name !== 'Recomendações' && (
    <div className="text-right">
      <span className={cn("text-2xl font-bold tabular-nums", getPassRateColor())}>
        {category.passRate}%
      </span>
      <p className="text-xs text-muted-foreground">aprovação</p>
    </div>
  )}
  {category.name === 'Recomendações' && (
    <div className="text-right">
      <span className="text-sm text-muted-foreground font-medium">
        Sugestões de melhoria
      </span>
    </div>
  )}
  {isExpanded ? (
    <ChevronUp className="w-5 h-5 text-muted-foreground" />
  ) : (
    <ChevronDown className="w-5 h-5 text-muted-foreground" />
  )}
</div>
```

**Depois:**
```tsx
<div className="flex items-center gap-4">
  {category.name !== 'Recomendações' && (
    <span className={cn("text-lg font-semibold tabular-nums", getPassRateColor())}>
      {category.passRate}%
    </span>
  )}
  {category.name === 'Recomendações' && (
    <span className="text-sm text-muted-foreground font-medium">
      Sugestões
    </span>
  )}
  {isExpanded ? (
    <ChevronUp className="w-5 h-5 text-muted-foreground" />
  ) : (
    <ChevronDown className="w-5 h-5 text-muted-foreground" />
  )}
</div>
```

#### 5. Remover categoryDescriptions (Opcional)

O objeto `categoryDescriptions` pode ser mantido para uso futuro em tooltips, mas não será mais exibido inline.

---

### Resumo das Alterações

| Item | Antes | Depois |
|------|-------|--------|
| Texto "X verificações" | Inline abaixo do nome | Badge compacta |
| Texto "aprovação" | Abaixo do percentual | Removido |
| Descrição da categoria | Exibida inline | Removida (mantida no código para tooltips) |
| Severidades | Não exibidas | Badges coloridas (crítico, alto, médio, baixo) |
| Tamanho do percentual | `text-2xl` | `text-lg` (mais compacto) |

---

### Resultado Final

O cabeçalho de categoria do Firewall terá paridade visual completa com o de Domínios Externos:
- Layout horizontal compacto
- Nome + Badge de contagem + Badges de severidade + Percentual
- Cores padronizadas por severidade (Red/Orange/Yellow/Blue)

