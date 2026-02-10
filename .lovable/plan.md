
# Corrigir Descricao dos Cards Entra ID (Campo `criteria` ausente)

## Problema

Os cards de conformidade do Entra ID exibem o texto dinamico da analise (ex: "{110} usuario(s) sem MFA configurado.") em vez da descricao estatica da regra (ex: "Verifica se todos os usuarios possuem MFA configurado.").

Este e o mesmo problema que ja foi corrigido no Exchange Online.

## Causa Raiz

As funcoes `createInsight` e `createNotFoundInsight` em `m365-security-posture/index.ts` nao incluem o campo `criteria` na saida. O frontend espera esse campo para exibir a descricao estatica da regra no Level 1 do card:

```text
// Frontend mapper (complianceMappers.ts, linha 247)
description: insight.criteria || insight.description
                  ^^^^^^^^^       ^^^^^^^^^^^^^^^^^^
                  (ausente!)      (cai no fallback = texto dinamico)
```

## Correcao

Adicionar `criteria: rule.description` ao objeto retornado em ambas as funcoes:

**Arquivo:** `supabase/functions/m365-security-posture/index.ts`

### Em `createInsight` (~linha 769-791)
Adicionar campo `criteria` com a descricao estatica da regra do template.

### Em `createNotFoundInsight` (~linha 816-838)
Adicionar campo `criteria` com a descricao estatica da regra do template.

Isso garante que:
- `criteria` = descricao estatica da regra ("Verifica se...") -> exibido no Level 1 do card
- `descricaoExecutiva` = resultado dinamico da analise ("{110} usuarios sem MFA") -> exibido na secao "ANALISE EFETUADA"

## Resultado esperado

- Cards do Entra ID exibem a descricao da regra (do template) no subtitulo
- Texto dinamico aparece apenas na secao "ANALISE EFETUADA" ao expandir o card
- Comportamento identico ao Exchange Online
