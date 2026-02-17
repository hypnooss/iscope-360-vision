

# Enriquecer tooltip do IP com dados WHOIS/RDAP adicionais

## Contexto

O tooltip do badge IP atualmente exibe: ASN, org, pais, range, abuse email e tech email. O usuario quer adicionar campos tipicos de registros LACNIC/NIC.br: **owner**, **ownerid** (CNPJ/CPF), **responsible** (pessoa tecnica) e **abuse-c** (handle do contato de abuso).

## Alteracoes

### 1. Backend - Python Agent (`python-agent/agent/executors/asn_classifier.py`)

**Extrair novos campos do WHOIS:**

Adicionar patterns de extracao no metodo `run()` apos o WHOIS lookup, usando `_extract_field` no output WHOIS:

- `owner:` -> campo `owner` (nome do proprietario do bloco)
- `ownerid:` -> campo `ownerid` (CNPJ/CPF no formato XX.XXX.XXX/XXXX-XX)
- `responsible:` -> campo `responsible` (pessoa responsavel)
- `abuse-c:` -> campo `abuse_handle` (handle do contato de abuso, ex: "RTM23")

Isso requer refatorar ligeiramente o `_whois_lookup` para retornar o texto bruto do WHOIS alem dos campos ja extraidos, ou fazer a extracao dentro de `run()` com uma nova chamada ao servidor WHOIS (menos eficiente). A abordagem preferida e retornar tambem o texto bruto.

**Extrair equivalentes do RDAP:**

No metodo `_parse_rdap`, extrair:
- `handle` da entidade registrant -> `abuse_handle` (fallback)
- `fn` da entidade technical -> `responsible` (fallback)

**Incluir no resultado:**

Adicionar os 4 campos ao dicionario `result['data']` (somente quando nao vazios).

### 2. Frontend - Interface (`src/pages/external-domain/AttackSurfaceAnalyzerPage.tsx`)

**Atualizar `ExposedAsset.asn`** (linha 354):

Adicionar campos opcionais:

```text
owner?: string;
ownerid?: string;
responsible?: string;
abuse_handle?: string;
```

**Atualizar `IpTooltipBody`** (linhas 916-947):

Reorganizar o tooltip para exibir as informacoes solicitadas. Campos sem valor exibem "indisponivel" em italico. Layout proposto:

```text
AS10429 (TELEFONICA BRASIL S.A.)
[bandeira] Pais: BR
Range: 186.192.0.0 - 186.207.255.255
────────────────────────────────
abuse-c:       RTM23                    (ou indisponivel)
owner:         FINCH BRASIL SOLUCOES... (ou indisponivel)
ownerid:       11.498.808/0002-48       (ou indisponivel)
responsible:   Renato Mandaliti         (ou indisponivel)
────────────────────────────────
Abuse: abuse@example.com
Tecnico: tech@example.com
```

Os novos campos serao sempre exibidos (com fallback "indisponivel" em italico), enquanto os existentes (ASN, pais, range, emails) mantem o comportamento atual de so aparecer quando presentes.

### 3. Detalhes tecnicos

**WHOIS patterns a extrair** (comuns em respostas LACNIC/NIC.br):
```text
r'owner:\s*(.+)'       -> owner
r'ownerid:\s*(.+)'     -> ownerid  
r'responsible:\s*(.+)' -> responsible
r'abuse-c:\s*(.+)'     -> abuse_handle
```

**Refatoracao do `_whois_lookup`**: Retornar tupla de 4 elementos `(provider, asn, org, raw_text)` em vez de 3, para que `run()` possa extrair os campos adicionais do texto bruto sem refazer a consulta WHOIS.

**Nenhuma migracao de banco necessaria**: os dados ASN sao armazenados como JSON dentro do campo `results` do snapshot, sem schema fixo.

