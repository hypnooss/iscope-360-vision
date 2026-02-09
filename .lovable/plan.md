

# Correcao do Mapeamento de Insights para UnifiedComplianceCard

## Problema

Nos mappers de `ExchangeInsight`, `SecurityInsight` e `ApplicationInsight`, o campo `description` do insight (que contem o texto dinamico da analise, ex: "2 regra(s) de inbox estao encaminhando e-mails automaticamente...") esta sendo mapeado tanto para `description` quanto para `failDescription` do `UnifiedComplianceItem`.

O resultado e que o texto da **analise efetuada** aparece na area da **descricao da regra** (nivel 1 do card), em vez de aparecer apenas na secao expandida "ANALISE EFETUADA".

## Causa Raiz

Todos os tres tipos de insight possuem um campo `criteria` que descreve **o que a validacao verifica** (ex: "Verifica regras de inbox que encaminham e-mails automaticamente"). Este campo nao esta sendo usado no mapeamento.

## Correcao

No arquivo `src/lib/complianceMappers.ts`, ajustar os tres mappers para:

- `description` = `insight.criteria` (descricao estatica da validacao — exibida no nivel 1 do card)
- `failDescription` = `insight.description` (resultado dinamico da analise — exibido como mensagem contextual de falha)
- `details` = `insight.description` (tambem alimenta a secao "ANALISE EFETUADA" ao expandir)

### Mappers afetados

| Mapper | Arquivo fonte |
|--------|--------------|
| `mapSecurityInsight` | SecurityInsight (Entra ID Security) |
| `mapExchangeInsight` | ExchangeInsight (Exchange Online) |
| `mapApplicationInsight` | ApplicationInsight (Entra ID Applications) |

## Detalhes Tecnicos

Alteracao unica no arquivo `src/lib/complianceMappers.ts`. Para cada um dos tres mappers, trocar:

```text
Antes:
  description: insight.description,
  failDescription: insight.description,

Depois:
  description: insight.criteria,
  failDescription: insight.description,
  details: insight.description,
```

Isso garante que:
1. O **nivel 1** do card exibe o `criteria` (o que a regra verifica)
2. A **mensagem contextual** de falha exibe o `description` dinamico (resultado da analise)
3. A secao expandida **"ANALISE EFETUADA"** tambem mostra o texto da analise

Nenhuma alteracao em tipos, componentes ou banco de dados e necessaria.

