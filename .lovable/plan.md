
# Corrigir Exibicao de Alteracoes de Configuracao Vazias

## Problema Raiz

Os snapshots mais antigos do BAU-FW foram processados ANTES do edge function ser atualizado com a logica de `configChangeDetails`. Resultado:
- `configChanges: 3` (contagem correta)
- `configChangeDetails: []` (array vazio - dados nao foram gerados)

O snapshot mais recente (17:15) JA TEM os dados corretos com 3 detalhes. Porem a pagina pode estar mostrando dados em cache (React Query staleTime de 2 minutos).

## Mudancas

### 1. Reduzir staleTime e forcar refetch na pagina de Config Changes

No `AnalyzerConfigChangesPage.tsx`, usar o hook com opcoes que forcam dados frescos:
- Criar uma chamada direta ao `useLatestAnalyzerSnapshot` ou usar `refetchOnMount: 'always'`
- Como o hook `useLatestAnalyzerSnapshot` nao aceita opcoes extras, a solucao e adicionar um botao de "Atualizar" que chama `refetch()` manualmente

### 2. Mostrar mensagem informativa quando dados estao incompletos

Quando `configChanges > 0` mas `configChangeDetails` esta vazio, exibir uma mensagem explicando que os dados de detalhe nao estao disponiveis neste snapshot e sugerindo re-executar a analise.

### 3. Expor `refetch` no hook e adicionar botao de refresh

Alterar a pagina para usar o retorno `refetch` do hook e adicionar um botao de atualizar na interface.

## Secao tecnica

### Arquivo: `src/pages/firewall/AnalyzerConfigChangesPage.tsx`

1. Extrair `refetch` do hook:
```text
const { data: snapshot, isLoading, refetch } = useLatestAnalyzerSnapshot(selectedFirewall || undefined);
```

2. Adicionar botao de refresh no header ao lado do select de firewall

3. Adicionar logica de fallback:
```text
const configChangesCount = snapshot?.metrics?.configChanges || 0;
const details = snapshot?.metrics?.configChangeDetails || [];

// Se tem contagem mas sem detalhes, mostrar aviso
if (configChangesCount > 0 && details.length === 0) {
  // Mostrar: "X alteracoes detectadas, mas os detalhes nao estao disponiveis 
  // neste snapshot. Execute uma nova analise para gerar os dados detalhados."
}
```

### Arquivo: `src/hooks/useAnalyzerData.ts`

Reduzir `staleTime` do hook `useLatestAnalyzerSnapshot` de 2 minutos para 30 segundos, garantindo que dados frescos sejam buscados mais rapidamente apos nova analise.

### Arquivos a editar
- `src/pages/firewall/AnalyzerConfigChangesPage.tsx` - Adicionar botao refresh, mensagem de fallback
- `src/hooks/useAnalyzerData.ts` - Reduzir staleTime para 30s
