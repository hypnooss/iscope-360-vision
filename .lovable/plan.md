
# Mover botao "Analisar" de Dominios para Compliance

## Resumo

Remover o botao Play (Analisar) da coluna de acoes em **Dominios Externos** e adiciona-lo na coluna de acoes em **Compliance**. Para que dominios sem analise aparecam na tela de Compliance, a query dessa pagina precisa ser refatorada para listar todos os dominios (nao apenas os que tem historico de analise).

## Mudancas

### 1. ExternalDomainTable - Remover botao Analisar

No componente `src/components/external-domain/ExternalDomainTable.tsx`:
- Remover o botao Play/Analisar (linhas 100-112)
- Remover props `analyzingId` e `onAnalyze` da interface e do componente
- Remover imports `Play` e `Loader2` que ficarem sem uso (manter `Loader2` pois e usado no loading state)
- Remover `Play` do import de lucide-react

### 2. ExternalDomainListPage - Limpar props do Table

No `src/pages/external-domain/ExternalDomainListPage.tsx`:
- Remover o estado `analyzing` e a funcao `handleAnalyze` (nao mais necessarios nesta pagina)
- Remover as props `analyzingId` e `onAnalyze` na chamada do `ExternalDomainTable`
- Limpar imports nao utilizados (`Play`)

### 3. ExternalDomainReportsPage - Adicionar botao Analisar e listar todos os dominios

Este e o passo mais significativo. No `src/pages/external-domain/ExternalDomainReportsPage.tsx`:

**3a. Refatorar `fetchReports` para incluir dominios sem analise**

Atualmente a query parte de `external_domain_analysis_history` e depois busca os dominios. Precisa inverter: buscar primeiro todos os `external_domains` (filtrados por workspace/preview), depois buscar o historico correspondente. Dominios sem historico aparecem na tabela com score vazio e sem analises.

**3b. Adicionar estado e funcao `handleAnalyze`**

Copiar a logica de `handleAnalyze` do `ExternalDomainListPage` (invoca `trigger-external-domain-analysis` edge function). Adicionar estado `analyzingId`.

**3c. Adicionar botao Play na coluna de acoes**

Na celula de acoes (linha 542-557), adicionar o botao Play antes do botao Eye (Visualizar). O botao Eye so aparece se houver analise selecionada com status `completed`.

**3d. Buscar `agent_id` dos dominios**

A query de dominios precisa incluir `agent_id` para que a validacao do `handleAnalyze` funcione (verificar se tem agent configurado).

**3e. Atualizar stats e interface**

Os stats cards continuam funcionando pois sao calculados sobre `groupedDomains`. Dominios sem analise contarao como "Total" mas nao incrementarao nenhum status.

## Detalhes tecnicos

### Arquivo: `src/components/external-domain/ExternalDomainTable.tsx`

- Remover `Play` do import lucide-react
- Remover `analyzingId` e `onAnalyze` da interface `ExternalDomainTableProps`
- Remover da desestruturacao do componente
- Remover o `<Button>` de Analisar (linhas 100-112)
- Remover `disabled={analyzingId === domain.id}` dos botoes Editar e Excluir

### Arquivo: `src/pages/external-domain/ExternalDomainListPage.tsx`

- Remover estado `analyzing` (`useState<string | null>(null)`)
- Remover funcao `handleAnalyze`
- Remover props `analyzingId={analyzing}` e `onAnalyze={handleAnalyze}` do `<ExternalDomainTable>`

### Arquivo: `src/pages/external-domain/ExternalDomainReportsPage.tsx`

**Imports**: Adicionar `Play` de lucide-react. Adicionar import de `supabase.functions`.

**Interface `GroupedDomain`**: Adicionar campo `agent_id: string | null`.

**`fetchReports` refatorado**:
1. Buscar `external_domains` com `id, name, domain, client_id, agent_id` (filtro workspace/preview)
2. Buscar `external_domain_analysis_history` para os domain_ids encontrados
3. Montar os grupos incluindo dominios sem historico (analyses = [])

**Novo estado e funcao**:
```text
const [analyzingId, setAnalyzingId] = useState<string | null>(null);

const handleAnalyze = async (domainId: string, agentId: string | null) => {
  // Mesma logica do ExternalDomainListPage
  // Invoca trigger-external-domain-analysis
  // Apos sucesso, chama fetchReports() para atualizar a lista
};
```

**Tabela - coluna Acoes**:
- Botao Play (Analisar) - sempre visivel
- Botao Eye (Visualizar) - visivel apenas se `currentAnalysis?.status === 'completed'`

**Stats**: Ajustar contagem para tratar dominios sem analise (sem status) como uma categoria separada ou excluir dos contadores de status.
