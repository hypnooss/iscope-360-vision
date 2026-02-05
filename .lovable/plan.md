
Plano v2 — Refatoração do Módulo Microsoft 365 (Revisado com melhorias arquiteturais)
Visão Geral

Transformar o módulo M365 de uma estrutura centrada em produtos técnicos (Entra ID, Exchange) para um modelo híbrido centrado em categorias de risco, mantendo o contexto do produto para a remediação.

Objetivos:

Descoberta por risco (executivo)

Correção por produto (técnico)

Score consolidado

Linguagem simples estilo relatório de compliance

Guia de correção passo-a-passo

Estado Atual vs Estado Desejado

(sem alterações — arquitetura proposta está correta)

Fases de Implementação
✅ Fase 1: Modelo de Dados Unificado (Fundação) — CONCLUÍDA
Arquivos criados:
- src/types/m365Insights.ts

✅ Fase 2: Edge Function Consolidada (AJUSTADA) — CONCLUÍDA
Arquivos criados:
- supabase/functions/m365-security-posture/index.ts
- src/hooks/useM365SecurityPosture.ts

⏳ Fase 3: Nova Estrutura de Navegação — PRÓXIMA

Objetivo: Criar um modelo de dados único que suporte todos os insights M365 com informações completas de remediação.

👉 Status: arquitetura excelente, manter.

1.1 Novo Tipo TypeScript: M365Insight
🔵 Melhoria adicionada:

Adicionar origem do dado (Graph vs PowerShell) + suporte a histórico.

Versão ajustada:
export type InsightSource =
  | 'graph'
  | 'exchange_powershell'
  | 'mixed';

export interface M365Insight {
  id: string;
  code: string;

  category: M365RiskCategory;
  product: M365Product;
  severity: M365Severity;

  titulo: string;
  descricaoExecutiva: string;
  riscoTecnico: string;
  impactoNegocio: string;

  scoreImpacto: number;
  status: 'pass' | 'fail' | 'warning';

  evidencias: unknown[];
  affectedCount: number;

  endpointUsado: string;

  // 🔵 NOVO → origem da coleta
  source: InsightSource;

  remediacao: RemediationGuide;

  detectedAt: string;

  // 🔵 NOVO → histórico/tendência futura
  previousStatus?: 'pass' | 'fail' | 'warning';
}

Motivo

Exchange não é 100% coberto pelo Graph

facilita debug

prepara terreno para histórico

1.2 Blueprints no banco

👉 manter

🟢 Boa prática adicional

Adicionar:

first_seen_at
last_seen_at


Para tracking de risco recorrente.

⚠️ Fase 2: Edge Function Consolidada (AJUSTADA)

Objetivo: Retornar todos os insights organizados.

🔴 Mudança importante

❌ NÃO implementar lógica inteira numa função monolítica gigante
✅ Implementar modular internamente

2.1 Nova Edge Function: m365-security-posture
Estrutura recomendada:
await Promise.all([
  collectIdentityInsights(),
  collectAuthInsights(),
  collectPrivilegeInsights(),
  collectAppsInsights(),
  collectExchangeInsights(),
  collectThreatInsights()
]);

Motivo

paraleliza

evita timeout

facilita manutenção

falha parcial não quebra tudo

melhora performance

🔵 NOVO — Cache recomendado

Adicionar cache por tenant:

duração: 5–15 min

evita estourar limites Graph

melhora UX

🔵 NOVO — Snapshots históricos

Criar:

m365_posture_snapshots
m365_insight_history


Para:

tendência

evolução do score

relatórios mensais

comparação “antes/depois”

Valor de negócio:

Executivos valorizam MUITO evolução, não só estado atual.

2.2 Mapeamento de Verificações

👉 manter lista

🟡 Atenção técnica importante

Alguns checks NÃO podem usar Graph apenas:

Necessário PowerShell (Exchange):

SMTP AUTH

POP/IMAP

AntiPhish/SafeLinks

Mailbox permissions

Transport rules

Usar:
Exchange Online PowerShell module

Marcar esses insights como:

source: 'exchange_powershell'

✅ Fase 3: Nova Estrutura de Navegação

👉 layout proposto está excelente — manter.

Categoria + Produto visível = modelo híbrido perfeito.

Sem alterações.

⚠️ Fase 4: Cálculo de Score (MELHORADO)
Problema do algoritmo atual

Penalidade fixa por severidade não escala bem:

1 usuário sem MFA ≠ 500 usuários

tenants grandes ficam injustos

🔵 Novo algoritmo recomendado
function calculatePenalty(insight: M365Insight) {
  const severityWeight = {
    critical: 15,
    high: 8,
    medium: 4,
    low: 2,
    info: 0
  }[insight.severity];

  const impactScale = Math.log10(insight.affectedCount + 1) + 1;

  return severityWeight * insight.scoreImpacto * impactScale;
}

score = 100 - sum(penalties)

Benefícios

✔ proporcional
✔ escalável
✔ mais justo
✔ mais profissional

⚠️ Permissões Graph API (AJUSTE DE SEGURANÇA)
Remover

❌ Policy.ReadWrite.ConditionalAccess

Usar apenas
Policy.Read.All

Motivo

princípio do menor privilégio

menos fricção no consent

melhor segurança SaaS

🔵 NOVO — Fase 5: Histórico & Tendências

Adicionar:

Funcionalidades:

score ao longo do tempo

gráfico de tendência

“+15% melhoria no último mês”

novos riscos vs riscos resolvidos

Tabelas:
m365_posture_snapshots
m365_insight_history

Valor:

Transforma o produto em:
👉 auditoria contínua (não só scanner pontual)

Cronograma Ajustado
Fase	Escopo	Tempo
1	Modelo de dados	2h
2	Edge modular + cache	10h
3	UI	8h
4	Score inteligente	2h
5	Histórico & tendências	4h
Total		~26–28h
✅ Veredito Final

Plano original: excelente
Com ajustes: nível produto enterprise

Arquitetura final agora possui:
✔ modelo híbrido
✔ dados unificados
✔ modularidade
✔ histórico
✔ score justo
✔ Graph + PowerShell
✔ UX executiva

👉 pronto para escalar como produto comercial sério.
