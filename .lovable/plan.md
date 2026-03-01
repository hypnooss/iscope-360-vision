

## Corrigir exibição de Evidências e Dados Brutos no M365 Compliance

### Problema 1: Entidades afetadas na mesma linha
No `EvidenceItemDisplay`, quando `type === 'list'`, o valor (que contém `\n` entre entidades) é renderizado como texto simples em um `<p>` tag, que ignora quebras de linha. Precisa renderizar cada entidade em sua propria linha.

### Problema 2: Dados Brutos (JSON) vazio
No `mapM365Insight`, o `rawData` é condicionado a `insight.evidencias && insight.evidencias.length > 0`. Se `evidencias` for um array vazio `[]`, o `rawData` fica `undefined`. Alem disso, devemos incluir mais dados brutos uteis (como o endpoint, status, affected count) para que a aba Dados tenha conteudo mesmo quando `evidencias` esta vazio.

### Alteracoes

**Arquivo 1: `src/components/compliance/EvidenceDisplay.tsx`**
- Adicionar tratamento para `type === 'list'` ANTES do fallback padrao (antes da linha 520)
- Quando `type === 'list'`, dividir o valor por `\n` e renderizar cada item em uma linha separada com borda lateral, igual ao padrao de nameservers

**Arquivo 2: `src/lib/complianceMappers.ts`**
- Na funcao `mapM365Insight`, construir `rawData` de forma mais robusta: incluir `evidencias` (quando existir), mais o objeto completo do insight (ou campos selecionados como `endpointUsado`, `status`, `affectedCount`, `category`) para que a aba Dados sempre tenha conteudo quando ha dados disponiveis
- Alterar a condicao para: se `insight.evidencias` existir (array com itens) OU se existirem outros dados relevantes

### Arquivos a editar
1. `src/components/compliance/EvidenceDisplay.tsx` — adicionar handler para `type === 'list'`
2. `src/lib/complianceMappers.ts` — enriquecer `rawData` com mais campos do insight

