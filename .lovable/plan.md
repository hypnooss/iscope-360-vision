

# Reestruturar Enriquecimento: Shodan + Censys (primarios), InternetDB (fallback), SecurityTrails (DNS)

## Hierarquia de fontes

```text
Para cada IP:
  1. Shodan API + Censys API (primarios, em paralelo)
     |
     +-- Merge dos resultados (portas, servicos, CVEs, banners, OS, certificados TLS)
     |
     +-- Se AMBOS falharem -> Fallback para InternetDB
     |
  2. Shodan InternetDB (fallback, gratuito)
     |
     +-- Usado SOMENTE se Shodan E Censys falharam
     |
  3. SecurityTrails (complementar)
     |
     +-- SOMENTE DNS reverso / hostnames associados ao IP
```

## Mudancas tecnicas

### Arquivo: `supabase/functions/attack-surface-scan/index.ts`

#### 1. Nova funcao `queryCensys(ip, apiKey)`
- Endpoint: `GET https://search.censys.io/api/v2/hosts/{ip}`
- Autenticacao: Basic Auth (a CENSYS_API_KEY deve conter `API_ID:API_SECRET`)
- Retorna: portas, servicos com banners, protocolo de transporte, software detectado, certificados TLS, OS
- Mapeamento para o mesmo formato `EnrichedIP`

#### 2. Alterar `enrichIP()` - novo fluxo
- Chamar Shodan e Censys em paralelo (`Promise.allSettled`)
- Fazer merge inteligente dos resultados:
  - Portas: uniao de ambos
  - Servicos: preferir o que tiver banner/product preenchido
  - CVEs: uniao
  - OS: preferir Shodan (mais preciso), fallback Censys
  - Hostnames: uniao
- Se AMBOS falharem, chamar InternetDB como fallback
- SecurityTrails continua complementando apenas hostnames (DNS reverso)

#### 3. Resolver CENSYS_API_KEY
- Adicionar `resolveApiKey(supabase, 'CENSYS_API_KEY')` no bloco de resolucao de chaves
- Log indicando se a chave esta disponivel

#### 4. Atualizar `EnrichmentSource` type
- Adicionar `'censys'` como fonte possivel
- Logica: se apenas Shodan = `'shodan'`, se apenas Censys = `'censys'`, se ambos = `'shodan+censys'`, se fallback = `'internetdb'`, se SecurityTrails complementou = adicionar `'+st'`

#### 5. Rate limiting
- Shodan: 1 req/sec
- Censys: 2.5 req/sec (Free tier = ~250 req/5min)
- Como rodam em paralelo, manter delay de ~1.1s entre IPs

### Formato da Censys API Key
- A chave armazenada deve ser no formato `API_ID:API_SECRET` (separados por `:`)
- A descricao no card de configuracao sera atualizada para indicar esse formato

### Resultado esperado
- Dados mais completos: Censys traz banners e certificados TLS que o Shodan pode nao ter (e vice-versa)
- InternetDB so e usado quando as duas APIs primarias falham (ex: IP sem dados em nenhuma)
- SecurityTrails continua exclusivamente para DNS reverso
- Nenhuma mudanca no frontend necessaria

