
# Corrigir Sincronizacao de CVEs para FortiGate e SonicWall

## Problemas Identificados

1. **Timeout na Edge Function**: A funcao processa todas as 12 fontes sequencialmente numa unica execucao. Com rate limit de 6.5s/pagina do NVD e fontes com centenas de CVEs (ex: Node.js tem 518), a funcao excede o limite de 60s e morre sem atualizar o status -- deixando FortiGate preso em "syncing".

2. **Filtro SonicWall restritivo**: O filtro de descricao exige `"sonicos"` no texto, mas muitas CVEs do NVD mencionam apenas `"SonicWall"` sem o termo especifico `"SonicOS"`, resultando em 0 CVEs cacheadas.

## Solucao

### Arquivo: `supabase/functions/refresh-cve-cache/index.ts`

### 1. Processar apenas UMA fonte por invocacao (quando sem source_id)

Quando chamado sem `source_id`, ao inves de iterar todas as 12 fontes, selecionar apenas a fonte com sync mais antigo (ou nunca sincronizada) e processar somente ela. Isso garante que cada execucao termine dentro do timeout.

```text
Logica:
- Ordenar fontes por last_sync_at ASC NULLS FIRST
- Processar apenas a primeira (mais antiga)
- O cron job chamara a funcao periodicamente, cobrindo todas as fontes ao longo do tempo
```

### 2. Recovery automatico de status "syncing" travado

No inicio da funcao, antes de selecionar a fonte, resetar qualquer fonte que esteja em "syncing" ha mais de 30 minutos:

```text
UPDATE cve_sources 
SET last_sync_status = 'error', last_sync_error = 'Timeout: sync travou por mais de 30 minutos'
WHERE last_sync_status = 'syncing' 
AND last_sync_at < NOW() - INTERVAL '30 minutes'
```

### 3. Relaxar filtro de descricao do SonicWall

Na funcao `syncNistNvdSource`, alem de verificar `config.keyword` ("SonicOS") na descricao, tambem aceitar o nome do vendor ("sonicwall"):

```text
Antes: desc.includes("sonicos")
Depois: desc.includes("sonicos") || desc.includes("sonicwall")
```

Isso sera feito adicionando um campo `descriptionAliases` ao `FIREWALL_KEYWORD_MAP`:
- fortinet: aliases = ["fortios", "fortigate"]
- sonicwall: aliases = ["sonicos", "sonicwall"]

### 4. Resetar FortiGate travado (acao imediata)

Executar update manual via SQL para destravar o FortiGate que esta preso em "syncing" desde ontem.

## Resumo das Mudancas

| Local | Mudanca |
|-------|---------|
| refresh-cve-cache/index.ts | Processar 1 fonte por vez (mais antiga primeiro) |
| refresh-cve-cache/index.ts | Recovery automatico de syncs travados (>30 min) |
| refresh-cve-cache/index.ts | Adicionar aliases de descricao para SonicWall |
| SQL (manual) | Resetar status do FortiGate de "syncing" para "error" |
