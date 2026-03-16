

## Melhorar os Visuais dos 3 Steps com CVEs Reais

### Step 1 — CVE Cards (Identificação)
Substituir os CVE cards genéricos por cards mais ricos com dados reais:

- **CVE-2024-3094** (XZ Utils backdoor) — CVSS 10.0, Critical, RCE
- **CVE-2024-21762** (Fortinet FortiOS) — CVSS 9.8, Critical, Out-of-bounds Write  
- **CVE-2023-44228** (Log4Shell) — CVSS 10.0, Critical, RCE

Cada card terá: nome do CVE, produto afetado, CVSS score com badge colorido, e tags contextuais (Exploitable, In the Wild, etc.). Layout em cascata diagonal com melhor espaçamento e cards maiores.

### Step 2 — Risk Distribution (Priorização)
Melhorar o SankeyChart:

- Inverter a ordem para Critical no topo (mais relevante primeiro)
- Adicionar barras coloridas mais visíveis com gradientes distintos por severidade
- Usar cores semânticas claras: vermelho (Critical), laranja (High), amarelo (Medium), verde (Low)
- Adicionar um indicador de "Exploitable" vs "Total" em cada barra
- Aumentar o tamanho do card (`max-w-[440px]`)

### Step 3 — Workflow (Remediação)
Melhorar o header CVE card e os workflow steps:

- Header card: adicionar produto afetado, CVSS badge, e severidade
- Workflow cards: adicionar ícones específicos por ação (Shield, Ticket, Bell, AlertTriangle)
- Adicionar timestamp sutil em cada step ("há 2 min", "há 5 min")

### Arquivos afetados
- `src/components/landing/SteppedShowcase.tsx` — reescrever CVECard, SankeyChart, e WorkflowStepCard com dados reais e melhor layout

