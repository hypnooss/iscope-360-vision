
# Corrigir Coleta de Alteracoes de Configuracao no Firewall Analyzer

## Diagnostico

A coleta de alteracoes de configuracao do BAU-FW (e possivelmente outros firewalls com alto volume de eventos) **nao funciona** porque:

1. O step `config_changes` no blueprint hybrid do FortiGate usa o filtro `logdesc=~config` no endpoint `/api/v2/log/memory/event/system`
2. O FortiGate **ignora parcialmente esse filtro** e retorna todos os eventos do tipo `event/system`
3. O limite de `rows=500` satura com ruido: login failures (logid 0100032002), rogue AP, IPsec negotiations, SSL VPN stats, REST API requests
4. Nenhum log real de configuracao (logid `0100044547` - "Object attribute configured") aparece entre os 500 resultados

O GCP-FW capturou 4 alteracoes em um snapshot porque tem menos volume de ruido, mas isso e aleatorio e nao confiavel.

## Solucao

Corrigir o filtro do step `config_changes` no blueprint para usar o `logid` especifico de alteracoes de configuracao do FortiGate, eliminando todo o ruido.

### Mudanca no Blueprint (banco de dados)

Atualizar o step `config_changes` no blueprint hybrid ativo (id: `9e33ae45-053c-4ea2-9723-c9e0cf01549c`) alterando o filtro de:

```
/api/v2/log/memory/event/system?filter=logdesc=~config&rows=500
```

Para:

```
/api/v2/log/memory/event/system?filter=logid==0100044546||logid==0100044547&rows=500
```

Os logids sao:
- `0100044546` - "Object configured" (criacao/delecao de objetos)
- `0100044547` - "Object attribute configured" (edicao de atributos)

Isso garante que os 500 slots sejam usados exclusivamente para logs reais de configuracao, sem competir com login failures, VPN stats ou rogue AP.

### Secao Tecnica

A alteracao e feita via SQL update no campo `collection_steps` do blueprint:

```sql
UPDATE device_blueprints 
SET collection_steps = jsonb_set(
  collection_steps,
  -- localizar o step config_changes e atualizar o path
)
WHERE id = '9e33ae45-053c-4ea2-9723-c9e0cf01549c';
```

Na pratica, vamos atualizar o JSON do step `config_changes` para usar o novo path com filtro correto.

### O que NAO muda

- Nenhuma edge function
- Nenhum componente de UI
- A logica de parsing em `analyzeConfigChanges()` na edge function `firewall-analyzer` permanece identica (ela ja filtra por cfgpath, action modify, etc.)
- A tabela `analyzer_config_changes` continua recebendo dados normalmente
- Nenhum outro step do blueprint e afetado
