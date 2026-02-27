

## Plano: Unificar topo das páginas Compliance com o padrão Analyzer

### Problema
As páginas de Compliance têm layout de topo diferente do Analyzer:
- **Analyzer**: Breadcrumb → Título + Subtítulo (esquerda) | Seletores + Botão "Executar Análise" + ⚙️ (direita) → Barra de progresso → Linha "Última coleta"
- **Compliance (Firewall)**: Breadcrumb → Seletores em linha → Componente `Dashboard` com seu próprio header (título, botões, command center com `max-w-7xl mx-auto` e padding extra)
- **Compliance (Domínio)**: Breadcrumb → Seletores em linha → Header interno + Command Center

### Mudanças

#### 1. `src/pages/firewall/FirewallCompliancePage.tsx`
- Reorganizar o topo para seguir o padrão Analyzer:
  - Breadcrumb: `Firewall > Compliance`
  - Título "Firewall Compliance" + subtítulo (esquerda) | Seletores + botão "Executar Análise" (direita)
  - Linha "Última coleta" com data do snapshot selecionado (usando Badge, sem ser um seletor — o snapshot mais recente é carregado automaticamente)
- Remover o seletor de snapshot como dropdown — exibir apenas a data da última coleta como o Analyzer faz
- Mover os botões "Exportar PDF" e "Reanalisar" do componente `Dashboard` para o header da página (junto com o botão "Executar Análise")
- Remover o header redundante do `Dashboard` (título, botões) — ou passar uma prop para suprimi-lo

#### 2. `src/pages/external-domain/ExternalDomainCompliancePage.tsx`
- Mesmo padrão: Breadcrumb `Domínio Externo > Compliance`
- Título "Domain Compliance" + subtítulo (esquerda) | Seletores + botão "Executar Análise" (direita)
- Linha "Última coleta" com Badge
- Mover botões "Exportar PDF" e "Reanalisar" para o header

#### 3. `src/components/Dashboard.tsx`
- Remover o `max-w-7xl mx-auto` wrapper (alinhando com a padronização global de espaçamento)
- Remover o padding extra `p-6 lg:p-8` do container raiz (a página já fornece padding)
- Adicionar prop `hideHeader?: boolean` para suprimir o header interno (título + botões) quando a página já fornece esses elementos
- Quando `hideHeader=true`, renderizar direto do Command Center em diante

#### 4. `src/pages/m365/M365PosturePage.tsx`
- Ajustar breadcrumb para `Microsoft 365 > Compliance`
- Reorganizar header para o mesmo padrão: título (esquerda) | TenantSelector + botão "Atualizar" (direita)
- Linha "Última coleta" com Badge (já existe parcialmente)

### Resultado visual esperado (todas as páginas de Compliance)
```text
Módulo > Compliance

Título Compliance                    [Workspace ▼] [Ativo ▼]  ▶ Executar Análise  ⚙
Subtítulo descritivo

⏱ Última coleta: 26/02/2026, 23:43:33

[═══════════ Progress bar (quando rodando) ═══════════]

┌─────────────────────────────────────────────┐
│            Command Center / Conteúdo         │
└─────────────────────────────────────────────┘
```

