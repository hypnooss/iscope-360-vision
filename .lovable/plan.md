
## Objetivo (ajustes solicitados)
1) Em **Domínio Externo > Relatórios**:
- Trocar subtítulo do header para **“Histórico de análises de compliance”**
- Na tabela, coluna **Domínio**: parar de mostrar “duas vezes” e ajustar tipografia (mostrar apenas o domínio, ex: `estrela.com.br`)
- Trocar textos “verificação(ões)” para **“análise(s)”** em:
  - Badge da linha (ex: “1 análise(s)”)
  - CardDescription (ex: “X domínio(s) com Y análise(s) no total”)
  - CardTitle (ex: “Histórico de Análises”)

2) Em **Detalhe do relatório (análise de compliance de domínio externo)**:
- Ajustar o layout para ficar **igual ao Firewall > Análise**, com o mesmo padrão visual:
  - Header grande “Análise de Compliance”
  - Subtítulo “Relatório gerado em …”
  - Cards no mesmo grid (gauge à esquerda e painel info+stats à direita)
- Incluir **botão “Reanalisar”** (sem PDF, conforme escopo anterior), agendando nova análise via `trigger-external-domain-analysis`.

---

## O que vou mudar (arquivos)

### 1) `src/pages/external-domain/ExternalDomainReportsPage.tsx`
**1.1. Header da página**
- Alterar:
  - `Histórico de verificações de domínios externos` -> `Histórico de análises de compliance`

**1.2. Card de listagem**
- Alterar `CardTitle`:
  - `Histórico de Verificações` -> `Histórico de Análises`
- Alterar `CardDescription`:
  - `verificação(ões)` -> `análise(s)`

**1.3. Coluna “Domínio”**
Hoje:
- Mostra `domain_name` e `domain_url` (2 linhas) + badge, o que está parecendo “duplicado” no seu caso (porque name = domain).
Mudança aprovada por você:
- Mostrar **somente** `domain_url` (ex: `estrela.com.br`)
- Ajustar fonte/tipografia:
  - domínio em `font-medium` e tamanho `text-sm` (ou `text-base` se você quiser mais destaque; vou começar com `text-sm` alinhado ao restante da tabela)
- Badge:
  - `X verificação(ões)` -> `X análise(s)`

Implementação prática:
- Remover o bloco que renderiza `<p>{group.domain_name}</p>` e `<p className="text-xs ...">{group.domain_url}</p>`
- Substituir por **apenas** um `<p>` com `group.domain_url`

---

### 2) `src/pages/external-domain/ExternalDomainAnalysisReportPage.tsx`
Hoje essa página tem um layout “próprio” (Detalhes em card + gauge separado + stats em grid). Vamos refatorar para espelhar o padrão do Firewall (`src/pages/FirewallAnalysis.tsx` + `src/components/Dashboard.tsx`).

**2.1. Header igual ao Firewall**
- Trocar o header atual (“Relatório de Compliance / Resultado da análise…”) por:
  - Título: **“Análise de Compliance”**
  - Subtítulo: **“Relatório gerado em {data}”** (usando `generatedAt || report.generatedAt`)
- À direita:
  - Botão **Voltar** (outline)
  - Botão **Reanalisar** (variant “cyber” igual ao Firewall), com ícone `RefreshCw` e estado de loading.

**2.2. Botão “Reanalisar” (agendar análise)**
- Adicionar estado `isRefreshing`
- Implementar `handleRefresh` chamando:
  - `supabase.functions.invoke('trigger-external-domain-analysis', { body: { domain_id: domainId } })`
- Regras:
  - Se o domínio não tiver `agent_id`, mostrar toast de erro (mesmo padrão da tela de listagem)
  - Em sucesso: toast “Análise agendada!” (igual listagem), e opcionalmente sugerir acompanhar em Execuções
- Observação importante (comportamento diferente do firewall):
  - No firewall, “Reanalisar” gera resultado imediato (edge function retorna o relatório).
  - No domínio externo, “Reanalisar” **agenda** uma tarefa; o relatório aparecerá depois quando o agent concluir.
  - Não vou implementar polling automático nesta etapa; manteremos consistente com a tela de Domínios Externos.

**2.3. Painel “info + stats” igual ao Firewall**
- Substituir o Card “Detalhes” atual por um painel no estilo do Dashboard:
  - Um `glass-card` com borda `border-primary/20`
  - Parte superior: detalhes do domínio (Nome, Domínio, Cliente, Data) em grid com ícones (similar ao firewall)
  - Separador horizontal
  - Parte inferior: Stats cards compactos (Total/ Aprovadas/ Falhas/ Alertas)
- Manter o gauge à esquerda como já está, mas ajustar containers para bater com o layout:
  - Esquerda: gauge dentro do `glass-card rounded-xl p-6`
  - Direita: painel combinado

**2.4. Banner de issues críticas (igual ao Dashboard)**
- Adicionar o banner que aparece quando `report.failed > 0`, igual ao Dashboard.
- Isso ajuda a padronizar a experiência e destacar problemas.

**2.5. Seção “Verificações por Categoria”**
- Adicionar o mesmo título “Verificações por Categoria”
- Reusar `CategorySection` como já está, sem alterações funcionais.

**2.6. Dados necessários para reanálise**
- Hoje, ao buscar domínio, você carrega: `id, name, domain, client_id`.
- Vou incluir também `agent_id` na query para saber se o domínio pode ser reanalisado.
  - Atualizar o type local do estado `domain`.

---

## Sequência de execução
1) Ajustes textuais e UI na listagem de relatórios (rápido e direto).
2) Refatoração do detalhe para o layout do Firewall (header + grid + painel + banner).
3) Implementar “Reanalisar” no detalhe chamando `trigger-external-domain-analysis`.
4) Checagem manual (E2E):
   - Abrir Relatórios: validar textos e coluna Domínio
   - Abrir detalhe: conferir layout e botão Reanalisar
   - Clicar Reanalisar: confirmar toast e que a tarefa aparece em Execuções; depois confirmar novo histórico no relatório.

---

## Critérios de aceite
- Em “Domínio Externo > Relatórios”:
  - Subtítulo correto: “Histórico de análises de compliance”
  - Coluna Domínio mostra apenas `estrela.com.br` (uma vez), com tipografia ajustada
  - Badge e contadores usam “análise(s)”
- No detalhe do relatório:
  - Layout visual equivalente ao do Firewall (mesma estrutura de header e cards)
  - Botão “Reanalisar” funciona (agenda tarefa) e mostra feedback por toast
  - Sem botão PDF (mantido fora do escopo)

---

## Nota rápida (para próximas pequenas mudanças de texto)
Mudanças como subtítulo, labels e pequenos ajustes de tipografia também podem ser feitas via **Visual Edits** no Lovable (sem custo de créditos), quando o elemento for estático/selecionável.