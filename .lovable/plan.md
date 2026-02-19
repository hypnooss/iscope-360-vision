

# Ajustes no Motor de Findings - 3 Correções

## 1. Serviços de Risco: Detecção por nome do serviço independente da porta

**Problema:** Se o RDP estiver na porta 63389, o match por porta falha (só procura 3389). O fallback por nome de serviço já existe (linhas 380-391), mas o `name` do finding fica fixo como "RDP (porta 3389) exposto na internet" mesmo quando detectado na 63389.

**Correção:**
- Remover a dependência do número da porta no campo `name` da regra
- Tornar o `name` dinâmico, incluindo a porta real detectada (ex: "RDP exposto na porta 63389")
- Manter a lista de portas conhecidas como "dica rápida" mas o match por service name deve funcionar em qualquer porta
- O finding agrupará todos os ativos que expõem aquele serviço, independente da porta

**Mudança em `RISKY_SERVICES`:** Trocar o campo `name` fixo por um template (ex: `nameTemplate: "RDP exposto na internet"`) e gerar o nome final com as portas reais encontradas nas evidências.

## 2. HTTP sem TLS: Ignorar redirecionamentos 301/302

**Problema:** Um servidor HTTP que responde 301/302 redirecionando para HTTPS está funcionando corretamente. Não deve ser flagged como finding.

**Correção:**
- Na seção de "HTTP without TLS" (linhas 427-450), adicionar verificação do `status_code`
- Ignorar web services com `status_code` entre 300-399 (redirecionamentos)
- Apenas flaggear endpoints HTTP que servem conteúdo real (status 200-299)

**Código atual (linha 429):**
```
if (ws.url?.startsWith('http://'))
```

**Passa a ser:**
```
if (ws.url?.startsWith('http://') && (ws.status_code < 300 || ws.status_code >= 400))
```

## 3. Vulnerabilidades: Agrupar por Produto em vez de CVE individual

**Problema:** Exibir cada CVE do OpenSSH individualmente polui a tela. O que importa é: "OpenSSH 8.2 tem 5 vulnerabilidades conhecidas (2 critical, 3 high)".

**Correção:**
- Agrupar CVEs por produto (usando `cve.products` ou extraindo do nome do serviço do ativo)
- Cada finding de vulnerabilidade passa a ser por produto, não por CVE-ID
- Título: "OpenSSH 8.2 — 5 vulnerabilidades (2 Críticas, 3 Altas)"
- Dentro do finding, listar as CVEs como evidências (drill-down)
- A severidade do finding é a mais alta entre as CVEs do grupo
- Manter o agrupamento medium/low como já está

**Estrutura do novo finding de vulnerabilidade:**
```
name: "OpenSSH 8.2 — 5 vulnerabilidades conhecidas"
severity: critical (a pior do grupo)
evidence: [
  { label: "CVE-2024-1234", value: "CVSS 9.8 — Remote Code Execution" },
  { label: "CVE-2024-5678", value: "CVSS 8.1 — Auth Bypass" },
  ...
]
affectedAssets: [hosts que têm esse produto]
```

## Detalhes Técnicos

### Arquivo: `src/lib/surfaceFindings.ts`

**Seção 1 - Risky Services (linhas 127-420):**
- Adicionar campo `nameTemplate` às regras (sem porta hardcoded)
- No loop de geração, construir o nome dinamicamente com as portas reais detectadas
- Ex: se RDP detectado nas portas 3389 e 63389, o nome fica "RDP exposto na internet (portas 3389, 63389)"

**Seção 2 - Web Security (linhas 422-450):**
- Adicionar filtro de status_code para excluir redirects (3xx)

**Seção 3 - Vulnerabilities (linhas 482-559):**
- Criar mapa de CVEs agrupadas por produto em vez de por severity
- Para cada produto, calcular a severidade mais alta e contadores por severity
- Gerar um finding por produto (não por CVE)
- CVEs individuais viram evidências dentro do finding do produto
- Se o produto não for identificável, agrupar como "Produto desconhecido"

### Nenhum outro arquivo precisa ser alterado
Os componentes `SurfaceFindingCard` e `SurfaceCategorySection` já renderizam findings genéricos — a mudança é apenas no motor de geração.

