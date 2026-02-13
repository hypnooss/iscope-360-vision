

# Fix: Steps UTM 404 e IPS 500 - Suporte a Steps Opcionais

## Diagnostico

Os paths `/api/v2/log/memory/utm/webfilter` e `/api/v2/log/memory/utm/app-ctrl` estao corretos na especificacao da API FortiGate. O 404 ocorre porque algumas versoes do FortiOS retornam 404 quando o buffer de memoria para aquele subtipo esta vazio (sem logs recentes), em vez de retornar um array vazio. Isso e comportamento normal do FortiGate.

O erro 500 no `ips_events` e causado pelo operador `<=` no filtro (`severity<=2`) que nao e suportado em queries de log de memoria em certas versoes.

O problema principal e que o agent Python nao trata steps `optional: true` para executors que nao sejam PowerShell. Quando um step HTTP retorna erro (404/500), ele e marcado como `failed` e contamina o status geral da task para `partial`, mesmo que o step seja opcional.

## Alteracoes

### 1. Migration SQL - Atualizar blueprint

Atualizar os 3 steps problematicos no blueprint do Analyzer:

- **`ips_events`**: Remover filtro `severity<=2` do path (usar `/api/v2/log/memory/ips?rows=500`) e adicionar `"optional": true`
- **`webfilter_blocked`**: Adicionar `"optional": true` na config
- **`appctrl_blocked`**: Adicionar `"optional": true` na config

### 2. Agent Python - Suporte a `optional` em steps HTTP

**Arquivo**: `python-agent/agent/tasks.py`

Na secao de execucao de steps individuais (nao-PowerShell), entre as linhas 269-284, adicionar verificacao do campo `optional` na config do step:

```python
# Antes (linha 269):
step_status = 'failed' if result.get('error') else 'success'

# Depois:
is_optional = step.get('config', {}).get('optional', False)
if result.get('error') and is_optional:
    step_status = 'not_applicable'
    step_error = f"[optional] {result.get('error')}"
elif result.get('error'):
    step_status = 'failed'
else:
    step_status = 'success'
```

Quando um step opcional falha, ele e reportado como `not_applicable` em vez de `failed`, o que:
- Nao incrementa `steps_failed`
- Nao contamina o status final da task
- Permite que o `firewall-analyzer` processe normalmente os dados disponiveis

### 3. Edge function - Tratar dados ausentes

**Arquivo**: `supabase/functions/firewall-analyzer/index.ts`

No fluxo principal, verificar se os dados de webfilter/appctrl existem antes de chamar as funcoes de analise. Se nao existirem (step opcional retornou `not_applicable`), preencher as metricas com arrays vazios e contadores zero. Isso ja deve estar implementado com os defaults, mas garantir que nao ha crash quando os dados sao `undefined`.

## Sequencia

1. Migration SQL para corrigir o blueprint (optional flags + fix IPS path)
2. Atualizar `python-agent/agent/tasks.py` para respeitar `optional: true`
3. Verificar edge function para robustez com dados ausentes
4. Deploy da edge function (se necessario)

## Impacto

- Steps UTM que retornem 404 serao tratados como "nao aplicavel" sem afetar o status da analise
- O IPS deixa de dar 500 com a remocao do filtro problematico
- A analise completa normalmente e exibe os dados de webfilter/appctrl quando disponiveis

