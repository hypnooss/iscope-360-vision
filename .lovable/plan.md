

# Adicionar CVEs do IIS ao cache de vulnerabilidades

## O que sera feito

Inserir uma nova fonte de CVE na tabela `cve_sources` para o Microsoft IIS (Internet Information Services), seguindo o mesmo padrao das fontes existentes como Nginx, Apache HTTP Server, OpenSSH, etc.

## Detalhes

A infraestrutura ja esta pronta -- o `refresh-cve-cache` suporta o tipo `nist_nvd_web` que busca CVEs no NIST NVD por keyword. Basta inserir um registro na tabela `cve_sources` com:

| Campo | Valor |
|---|---|
| module_code | `external_domain` |
| source_type | `nist_nvd_web` |
| source_label | `Microsoft IIS` |
| config | `{"product_filter": "internet_information_services"}` |
| is_active | `true` |

O `product_filter` usa o nome do produto no NVD CPE (`internet_information_services`), que e o termo oficial usado pela Microsoft no repositorio NIST para o IIS.

## Nenhuma alteracao de codigo necessaria

Nao ha alteracoes em arquivos do projeto. Apenas um INSERT na tabela `cve_sources`. Apos a insercao, basta clicar "Sincronizar" no painel de Fontes de CVE para popular o cache.

