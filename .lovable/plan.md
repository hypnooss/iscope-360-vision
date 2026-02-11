
# Corrigir: Analyzer tem dados mas nao popula a tela

## Diagnostico

O snapshot mais recente tem metricas reais (`vpnFailures: 64`, `configChanges: 200`, `totalEvents: 264`) mas **0 insights gerados** e todos os severity cards em 0. A tela aparece "vazia" porque os widgets dependem de dados que nao estao sendo calculados:

| Widget | Status | Motivo |
|--------|--------|--------|
| Score de Risco | 100 (verde) | Sem insights = sem penalidade |
| Severity Cards | Todos 0 | Sem insights gerados |
| Top IPs Bloqueados | Vazio | `denied_traffic` coletou 0 logs |
| Top Paises | Vazio | Depende de denied_traffic |
| Resumo de Eventos | **OK** | Mostra vpnFailures=64, configChanges=200 |
| Insights Recentes | Vazio | 0 insights gerados |

## Causa Raiz

A edge function `firewall-analyzer` tem thresholds muito restritos e parsing de campos que nao coincidem com o formato real dos logs do FortiGate:

1. **VPN/Auth**: So gera insight de brute force quando UM usuario tem 10+ falhas. 64 falhas distribuidas = 0 insights
2. **Config Changes**: So detecta "add admin" ou "policy/rule/firewall" no campo `msg` — os 200 logs de config provavelmente usam outros termos
3. **Denied Traffic**: 0 logs coletados (pode ser que o filtro da API nao retornou nada, ou o firewall realmente nao teve trafego negado no periodo)

## Plano de Correcao

### 1. Edge Function `firewall-analyzer`: Adicionar insights agregados

Modificar `supabase/functions/firewall-analyzer/index.ts`:

**a) Em `analyzeAuthentication()`** -- Adicionar 2 novos insights:
- "Alto Volume de Falhas de Autenticacao" quando total de falhas > 20
- Listar os top 5 usuarios com mais falhas e seus IPs

**b) Em `analyzeConfigChanges()`** -- Adicionar insight de volume:
- "Volume Elevado de Alteracoes" quando total de config changes > 50
- Incluir contagem total e periodo

**c) Em `analyzeConfigChanges()`** -- Ampliar deteccao:
- Alem de "policy/rule/firewall", detectar tambem: "edit", "set", "delete", "add", "modify"
- Detectar alteracoes de HA, VPN, routing

**d) Adicionar parsing melhorado dos campos FortiGate**:
- O FortiGate usa campos como `cfgpath`, `cfgobj`, `cfgattr` para config changes
- Usar esses campos para gerar insights mais especificos (ex: "Politica de Firewall Alterada: policy 15")

### 2. Ajustar thresholds

| Insight | Threshold Atual | Novo Threshold |
|---------|----------------|----------------|
| Brute Force (por usuario) | 10 falhas | 5 falhas |
| Alto Volume Auth (total) | N/A | 20 falhas |
| Alto Volume Config | N/A | 50 alteracoes |
| Volume Alto Bloqueios (por IP) | 100 tentativas | 50 tentativas |

### 3. Melhorar parsing de config changes

Os logs de config do FortiGate tipicamente tem esta estrutura:
- `cfgpath`: ex. "firewall.policy", "system.interface", "vpn.ipsec.phase1-interface"
- `cfgobj`: o objeto alterado
- `cfgattr`: atributos modificados
- `action`: "Edit", "Add", "Delete"

A funcao atual so verifica `msg` e `logdesc`. Adicionar verificacao de `cfgpath` para categorizar alteracoes automaticamente.

### Resumo de Arquivos

| Arquivo | Alteracao |
|---------|-----------|
| `supabase/functions/firewall-analyzer/index.ts` | Adicionar insights agregados, ampliar parsing de config, ajustar thresholds |

Nenhuma alteracao de banco de dados necessaria. Apos o deploy, re-trigger da analise para validar que os insights sao gerados.
