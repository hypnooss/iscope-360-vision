

# Plano: Criar Firewall Analyzer v2

## Objetivo

Criar uma **versão v2** do Firewall Analyzer em uma rota separada (`/scope-firewall/analyzer-v2`) que permite experimentar novos enriquecimentos sem impactar a versão atual.

## Estrutura Proposta

### 1. Nova Rota
- **URL**: `/scope-firewall/analyzer-v2`
- **Componente**: `AnalyzerDashboardV2Page.tsx`
- Mantém toda a funcionalidade da v1 como base
- Permite adicionar novos recursos experimentais

### 2. Arquivos a Criar

```
src/pages/firewall/
  ├── AnalyzerDashboardV2Page.tsx    (nova página v2)
  
src/components/firewall/
  ├── AnalyzerStatsCardsV2.tsx       (opcional - se houver mudanças)
  ├── AnalyzerCategoryGridV2.tsx     (opcional - se houver mudanças)
```

### 3. Registro de Rota

No `App.tsx`, adicionar:
```tsx
<Route path="/scope-firewall/analyzer-v2" element={<AnalyzerDashboardV2Page />} />
```

### 4. Estratégia de Implementação

**Fase 1 - Duplicação Base:**
- Copiar `AnalyzerDashboardPage.tsx` → `AnalyzerDashboardV2Page.tsx`
- Adicionar badge "v2" no título da página
- Registrar rota no App.tsx
- Reutilizar componentes existentes inicialmente

**Fase 2 - Enriquecimentos (a definir):**
Baseado na sua necessidade, podemos adicionar:
- Análise temporal (comparação com períodos anteriores)
- Inteligência de ameaças (contexto sobre IPs)
- Drill-down detalhado (timelines, flows)
- Recomendações baseadas em padrões observados
- Outros recursos conforme feedback

### 5. Navegação

Adicionar link no menu lateral ou na página principal do Analyzer para acessar a v2:
```tsx
<Button variant="outline" onClick={() => navigate('/scope-firewall/analyzer-v2')}>
  Experimentar v2 <Badge>Beta</Badge>
</Button>
```

## Benefícios

1. **Segurança**: Versão atual permanece intacta
2. **Experimentação**: Liberdade para testar novas ideias
3. **Comparação**: Possibilidade de A/B testing
4. **Migração gradual**: Pode mover recursos da v2 para v1 depois de validados

## Próximos Passos

Após aprovação:
1. Criar estrutura base da v2
2. Definir quais enriquecimentos implementar primeiro
3. Implementar funcionalidades incrementalmente

