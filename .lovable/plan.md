
# Atualizacao do README.md do Python Agent

## O que precisa mudar

O README esta desatualizado em relacao ao codigo atual. As principais discrepancias sao:

### 1. Versao
- **Atual no README**: 1.2.3
- **Atual no codigo**: 1.2.10

### 2. Contagem e lista de executores
- **README diz**: 7 executores
- **Realidade**: 12 executores

Executores ausentes no README:
- `masscan` — Descoberta rapida de portas (alternativa ao nmap_discovery)
- `nmap` — Fingerprinting de servicos com modelo de duas fases (Phase 1: scan principal com PORT_SCRIPTS + scripts globais; Phase 2: enriquecimento condicional de portas exoticas via SERVICE_SCRIPTS)
- `nmap_discovery` — Descoberta de portas TCP em duas fases (top-ports 2000 + full range 1-65535), com fallback de -sS para -sT e deteccao de CDN
- `httpx` — Fingerprinting web (tecnologias, TLS, status codes) com modo CDN-aware
- `asn_classifier` — Classificacao de IP por ASN/provedor via WHOIS + RDAP, identifica CDN/Cloud para adaptar estrategia de scan

### 3. Pipeline de Attack Surface (secao nova)
O README nao menciona o pipeline de attack surface scanning que o Super Agent executa. Essa e uma secao importante que deve ser adicionada, descrevendo o fluxo:

```text
ASN Classifier -> Nmap Discovery (2 fases) -> Nmap Fingerprint (2 fases) -> httpx
```

### 4. Tipos de tarefa
A tabela de tipos de tarefa esta incompleta. Faltam:
- `attack_surface_scan` (ou similar — tarefas do Super Agent com steps sequenciais usando os novos executores)

### 5. Scheduler
O README nao menciona o scheduler com exponential backoff (`scheduler.py`). O arquivo esta listado na estrutura mas sem descricao do comportamento.

### 6. Estrutura de arquivos
Faltam 5 arquivos na arvore:
- `agent/executors/masscan.py`
- `agent/executors/nmap.py`
- `agent/executors/nmap_discovery.py`
- `agent/executors/httpx_executor.py`
- `agent/executors/asn_classifier.py`

### 7. Dependencias externas (CLI)
O README lista Amass e PowerShell como dependencias externas, mas faltam:
- `nmap` (obrigatorio para nmap_discovery e nmap)
- `httpx` (projectdiscovery/httpx)
- `masscan` (opcional, usado como alternativa)

### 8. Detalhes dos executores existentes
A secao de detalhes dos executores precisa incluir os 5 novos executores com:
- Descricao do que fazem
- Dependencias (CLI)
- Parametros principais
- Comportamento especial (CDN-aware, fallbacks, duas fases)

### 9. Tabela de pre-requisitos
Adicionar nmap e httpx na tabela de pre-requisitos.

### 10. Scripts NSE de seguranca
Incluir uma secao ou sub-secao no executor Nmap Fingerprint listando os scripts NSE integrados (17 scripts de seguranca em PORT_SCRIPTS e SERVICE_SCRIPTS).

## Secao tecnica: Mudancas no arquivo

**Arquivo unico**: `python-agent/README.md`

As alteracoes serao:
1. Atualizar versao de 1.2.3 para 1.2.10
2. Adicionar nmap, httpx, masscan na tabela de pre-requisitos
3. Atualizar contagem de executores de 7 para 12
4. Adicionar 5 novas linhas na tabela de executores
5. Adicionar secao "Detalhes dos Executores" para os 5 novos
6. Adicionar secao "Pipeline de Attack Surface" com diagrama ASCII do fluxo completo
7. Atualizar tabela de tipos de tarefa
8. Atualizar descricao do scheduler.py na estrutura de arquivos
9. Adicionar 5 arquivos faltantes na arvore de estrutura
10. Atualizar ano da licenca para 2024-2026
