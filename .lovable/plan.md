
# Adicionar tipo de breach (Scraping vs Credential Leak) na tabela HIBP

## Resumo

A API do HIBP no endpoint `/breacheddomain` retorna apenas o mapeamento `alias -> [breach_names]`, sem metadados sobre o tipo de breach. Para saber se um breach e do tipo "scraping" ou "credential leak", precisamos consultar o endpoint `/breaches` da HIBP, que retorna metadados como `DataClasses` (tipos de dados expostos) e `IsFabricated`, `IsSpamList`, `IsSensitive`, etc.

## Alteracoes

### 1. Edge Function: buscar metadados dos breaches (dehashed-search/index.ts)

Apos obter a lista de breaches do `/breacheddomain`, fazer uma chamada adicional ao endpoint publico `https://haveibeenpwned.com/api/v3/breaches` (nao requer API key) para obter metadados de todos os breaches. Cruzar os nomes para enriquecer cada entrada com:

- `breach_type`: classificacao derivada dos `DataClasses` do breach:
  - **"credential_leak"** se contem "Passwords" ou "Password hints"
  - **"stealer_logs"** se contem "Passwords" E o breach tem `IsMalware: true`
  - **"scraping"** se nao contem senhas (apenas emails, nomes, telefones, etc)
  - **"combo_list"** se `IsSpamList: true` ou `IsFabricated: true`

- Incluir `breach_type` em cada entrada do array `entries` salvo no cache

### 2. Frontend: coluna "Tipo" na tabela (LeakedCredentialsSection.tsx)

Adicionar uma coluna **"Tipo"** na tabela de resultados, entre "Breach" e o final:

- **Credential Leak**: Badge vermelha com icone Key
- **Stealer Logs**: Badge vermelha escura com icone Bug
- **Scraping**: Badge amarela com icone Globe
- **Combo List**: Badge laranja com icone List

Isso da contexto imediato ao usuario sobre a gravidade de cada entrada.

### 3. Cache retrocompativel

Entradas antigas no cache que nao possuem `breach_type` serao exibidas como "Desconhecido" com badge cinza, ate que uma nova consulta enriqueca os dados.

## Detalhes tecnicos

**Endpoint publico HIBP**: `GET https://haveibeenpwned.com/api/v3/breaches` retorna array com todos os breaches conhecidos. E publico (sem API key), mas faremos cache local em memoria durante a execucao da function para nao repetir chamadas.

**Mapeamento de tipo**: Criar funcao `classifyBreach(breach)` na edge function que analisa `DataClasses`, `IsMalware`, `IsSpamList`, `IsFabricated` para retornar o tipo.

**Estrutura da entrada enriquecida**:
```text
{
  email: "user@domain.com",
  username: "user",
  database_name: "Speedio",
  breach_type: "scraping",   // novo campo
  ...
}
```
