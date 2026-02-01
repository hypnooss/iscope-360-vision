

## Plano: Corrigir Ícone de Reload e Cores de Fundo das Categorias

### Problema 1: Ícone de Reload ao Alternar Abas

**Causa Raiz Identificada:**
Em `FirewallAnalysis.tsx`, o `useEffect` (linhas 132-142) é executado sempre que o componente é montado/remontado, chamando `fetchAnalysisDate()` repetidamente. Isso causa:
- Requisições duplicadas ao Supabase (visível nos logs de rede)
- Re-renderização do componente `Dashboard`
- Animação do ícone de refresh aparecendo brevemente

**Diferença com External Domain:**
O `ExternalDomainAnalysisReportPage.tsx` usa `useMemo` para manter o `initialReport` estável (linha 379-382) e só busca dados se não houver relatório inicial (linha 445-450).

**Solução:**

#### Alteração 1.1 - `FirewallAnalysis.tsx` - Estabilizar efeito

Usar `useRef` para controlar se já buscou os dados, evitando re-execução:

```typescript
const hasFetchedRef = useRef(false);

useEffect(() => {
  if (!id || !user) return;
  if (hasFetchedRef.current) return;
  
  hasFetchedRef.current = true;
  fetchFirewall();
  
  if (!initialReport) {
    fetchLastAnalysis();
  } else {
    fetchAnalysisDate();
  }
}, [id, user]);
```

#### Alteração 1.2 - Usar useMemo para initialReport

Memoizar a normalização do relatório inicial para evitar recálculo:

```typescript
const initialReport = useMemo(() => {
  if (!location.state?.report) return null;
  return normalizeReportData(location.state.report as Record<string, unknown>);
}, [location.state?.report]);
```

---

### Problema 2: Cores de Fundo das Categorias

**Causa Raiz Identificada:**
Em `CategorySection.tsx`, o botão usa a classe `glass-card` (linha 88), que aplica um fundo genérico. Não há estilos inline para aplicar a cor da categoria ao fundo.

**Diferença com External Domain:**
Em `ExternalDomainCategorySection.tsx`, o `Button` usa estilos inline (linhas 92-96):
```tsx
style={{
  backgroundColor: `${colorHex}10`,
  borderColor: `${colorHex}30`,
  borderWidth: '1px',
}}
```

**Solução:**

#### Alteração 2.1 - `CategorySection.tsx` - Aplicar cores dinâmicas

Substituir o uso de `glass-card` por estilos inline com a cor da categoria:

```tsx
<button
  onClick={() => setIsExpanded(!isExpanded)}
  className="w-full flex items-center justify-between p-4 rounded-lg mb-3 hover:border-primary/30 transition-colors"
  style={{
    backgroundColor: `${colorHex}10`,
    borderColor: `${colorHex}30`,
    borderWidth: '1px',
  }}
>
```

---

### Resumo das Alterações

| Arquivo | Problema | Solução |
|---------|----------|---------|
| `FirewallAnalysis.tsx` | Efeito re-executando | Adicionar `useRef` para controle + `useMemo` para relatório |
| `CategorySection.tsx` | Fundo genérico (glass-card) | Aplicar cor da categoria via `style` inline |

---

### Comparação Visual dos Cards de Categoria

**Antes (Firewall):**
```
┌─────────────────────────────────────────────────────────────────┐
│ [Glass-card genérico sem cor da categoria]                      │
│ [Icon] Nome da Categoria [badges...]                       85%  │
└─────────────────────────────────────────────────────────────────┘
```

**Depois (Padrão Domínio Externo):**
```
┌─────────────────────────────────────────────────────────────────┐
│ [Fundo colorido tênue (${colorHex}10) + borda colorida]         │
│ [Icon] Nome da Categoria [badges...]                       85%  │
└─────────────────────────────────────────────────────────────────┘
```

---

### Resultado Esperado

1. **Sem ícone de reload**: Ao alternar abas do navegador, a página não refaz requisições
2. **Cores consistentes**: Os cards de categoria do Firewall terão fundo e borda coloridos conforme configurado no Template do Fortigate

