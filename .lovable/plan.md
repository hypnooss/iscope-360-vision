

# Plano: Otimização de Performance da Página de Relatórios

## Diagnóstico

A página de Relatórios (`/scope-firewall/reports`) está com **timeout** porque a consulta tenta baixar **41 MB de dados** de uma só vez.

### Causa Raiz

| Problema | Valor |
|----------|-------|
| Query atual | `SELECT * FROM analysis_history` |
| Registros | 9 análises |
| Tamanho médio do `report_data` | **4.5 MB por registro** |
| Total transferido | **41 MB** |
| Limite de timeout do Supabase | 8 segundos |

A coluna `report_data` contém o JSON completo da análise (incluindo raw_data de algumas regras), que não é necessário para a listagem.

---

## Solução

Modificar a query para buscar **apenas os campos necessários** para a listagem, e carregar o `report_data` apenas quando o usuário clicar em "Visualizar".

### Arquivo: `src/pages/firewall/FirewallReportsPage.tsx`

#### 1. Otimizar a query de listagem

```typescript
// Antes (linha 86)
.select('*')

// Depois - buscar apenas campos leves
.select('id, firewall_id, score, created_at')
```

Isso reduz a transferência de **41 MB → ~10 KB** (melhoria de 99.97%).

#### 2. Ajustar o tipo `AnalysisReport`

Tornar `report_data` opcional na interface, já que não será carregado na listagem:

```typescript
interface AnalysisReport {
  id: string;
  firewall_id: string;
  firewall_name: string;
  client_id: string;
  client_name: string;
  score: number;
  created_at: string;
  report_data?: any;  // Opcional - carregado sob demanda
}
```

#### 3. Carregar `report_data` sob demanda

Modificar `handleViewReport` para buscar o `report_data` apenas quando necessário:

```typescript
const handleViewReport = async (group: GroupedFirewall) => {
  const analysis = getSelectedAnalysis(group);
  if (!analysis) return;
  
  // Buscar report_data sob demanda (se ainda não carregado)
  if (!analysis.report_data) {
    const { data } = await supabase
      .from('analysis_history')
      .select('report_data')
      .eq('id', analysis.id)
      .single();
    
    if (data) {
      analysis.report_data = data.report_data;
    }
  }
  
  navigate(`/scope-firewall/firewalls/${group.firewall_id}/analysis`, { 
    state: { report: analysis.report_data } 
  });
};
```

#### 4. Ajustar `handleDownloadPDF` da mesma forma

Carregar o `report_data` antes de gerar o PDF se ainda não estiver em memória.

---

## Resultado Esperado

| Métrica | Antes | Depois |
|---------|-------|--------|
| Dados transferidos na listagem | 41 MB | ~10 KB |
| Tempo de carregamento | Timeout (>8s) | <500ms |
| Dados carregados ao visualizar | Já em memória | ~4 MB sob demanda |

---

## Arquivos Modificados

- `src/pages/firewall/FirewallReportsPage.tsx`

## Complexidade

- Média - Refatoração de carregamento de dados

