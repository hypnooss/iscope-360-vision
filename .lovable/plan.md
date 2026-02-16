

# Corrigir product_filter do IIS para sincronizar CVEs

## Problema

A fonte "Microsoft IIS" foi inserida com `product_filter: "internet_information_services"` (com underscores). Porem, a funcao `syncNistNvdWebSource` usa esse valor diretamente como `keywordSearch` na API do NIST NVD, que busca nas **descricoes textuais** dos CVEs. As descricoes usam "Internet Information Services" (com espacos), entao a busca exata com underscores retorna 0 resultados.

Outras fontes como `nginx`, `openssh`, `php` funcionam porque sao palavras unicas sem espacos.

## Solucao

Atualizar o registro na tabela `cve_sources` para usar espacos no `product_filter`:

```sql
UPDATE cve_sources 
SET config = '{"product_filter": "Internet Information Services"}'
WHERE source_label = 'Microsoft IIS';
```

Apos o update, basta clicar "Sincronizar" novamente na pagina de Fontes.

## Detalhes tecnicos

- O `product_filter` e passado para `fetchAllNvdPages(productFilter, { useExactMatch: true })` (linha 305-306)
- Isso gera a URL: `keywordSearch=Internet Information Services&keywordExactMatch`
- A API NVD retornara CVEs cujas descricoes contenham exatamente "Internet Information Services"
- O codigo ja faz `.toLowerCase()` no filter (linha 294), mas isso nao afeta a busca na API NVD

## Arquivo modificado

| Arquivo | Mudanca |
|---|---|
| Nova migration SQL | UPDATE do config na tabela cve_sources para usar espacos em vez de underscores |

