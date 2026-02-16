
# Modal de Selecao de Dominio para Consulta HIBP

## Resumo

Ao clicar em "Consultar HIBP" ou "Atualizar", um modal (Dialog) sera exibido listando todos os dominios do workspace (tabela `external_domains`). O usuario seleciona um ou mais dominios e confirma para iniciar a consulta.

## Alteracoes

### 1. Buscar todos os dominios do cliente (AttackSurfaceAnalyzerPage.tsx)

Alterar a query `client-domain` para retornar **todos** os dominios em vez de apenas 1:
- Remover `.limit(1)` 
- Retornar array de `{ domain: string }` em vez de string unica
- Passar a lista completa para o `LeakedCredentialsSection`

### 2. Criar modal de selecao no LeakedCredentialsSection

Adicionar um Dialog dentro do componente `LeakedCredentialsSection.tsx`:
- Receber `domains: string[]` (lista de todos os dominios) em vez de `domain: string`
- Estado `modalOpen` para controlar abertura
- Lista de checkboxes com os dominios disponíveis
- Botao "Consultar" que dispara a mutation para cada dominio selecionado
- O botao "Consultar HIBP" e "Atualizar" abrem o modal em vez de executar diretamente

### 3. Adaptar exibicao de dados para multiplos dominios

- A query de cache buscara dados de **todos** os dominios do cliente (sem filtro por dominio unico)
- Agrupar/exibir resultados com indicacao do dominio de origem na tabela
- Stats consolidam todos os dominios consultados

## Detalhes tecnicos

**Props do componente** mudam de:
```text
{ clientId: string; domain: string | null; isSuperRole: boolean }
```
Para:
```text
{ clientId: string; domains: string[]; isSuperRole: boolean }
```

**Modal**: Usar `Dialog` do Radix (ja disponivel no projeto) com checkboxes para cada dominio. Pre-selecionar todos por padrao.

**Mutation**: Executar sequencialmente (ou em paralelo) a edge function `dehashed-search` para cada dominio selecionado, mostrando progresso.

**Tabela de resultados**: Adicionar coluna "Dominio" para distinguir de qual dominio veio cada entrada quando houver dados de multiplos dominios.

**Cache**: A query de cache passa a buscar todos os registros do `client_id` (sem filtro de dominio), agrupando por dominio.
