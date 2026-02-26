

## Reorganizar layout da aba Agents em Configurações

### Mudanças no layout

O card "Gerenciamento de Atualizações" será reestruturado para ter dois blocos independentes, cada um com seu formulário de publicação à esquerda e seu status específico à direita.

```text
┌─────────────────────────────────────────────────────────────────────┐
│  Gerenciamento de Atualizações                                      │
│  Agent: v1.3.4 | Supervisor: v1.0.0                                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─ Publicar Agent ──────────────┐  ┌─ Status dos Agents ─────────┐│
│  │  Versão: [______]             │  │  ✓ 5 atualizados            ││
│  │  Pacote: [escolher arquivo]   │  │    Agent v1.3.4             ││
│  │  SHA256: abc123...            │  │  ⚠ 26 desatualizados        ││
│  │  ☐ Forçar atualização         │  │    Aguardando update        ││
│  │  [Publicar Agent]             │  │                             ││
│  │                               │  │  • IEMADEIRA  Agent v1.3.2  ││
│  │                               │  │  • OCI-01    Agent v1.3.2   ││
│  └───────────────────────────────┘  └─────────────────────────────┘│
│                                                                     │
│  ┌─ Publicar Supervisor ─────────┐  ┌─ Status dos Supervisors ────┐│
│  │  Versão: [______]             │  │  ✓ 3 atualizados            ││
│  │  Pacote: [escolher arquivo]   │  │    Sup v1.0.0               ││
│  │  SHA256: def456...            │  │  ⚠ 2 desatualizados         ││
│  │  ☐ Forçar atualização         │  │    Aguardando update        ││
│  │  [Publicar Supervisor]        │  │                             ││
│  │                               │  │  • agent-01  Sup v0.9.0     ││
│  └───────────────────────────────┘  └─────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────┘
```

### Detalhes técnicos

**Arquivo:** `src/pages/admin/SettingsPage.tsx`

1. **Campo Pacote abaixo do campo Versão** — Remover o `grid md:grid-cols-2` dos formulários de Agent e Supervisor, empilhando Versão e Pacote verticalmente (como mostra o print 1).

2. **Separar `agentStats` em dois conjuntos independentes:**
   - `agentStats` — filtra apenas por `agent_version !== latestAgentVer` (ignora supervisor)
   - `supervisorStats` — filtra apenas por `supervisor_version !== latestSupVer` (ignora agent)
   - Cada um terá seus próprios contadores `upToDate` e lista `outdated`

3. **Layout lado a lado (grid cols-2):**
   - Coluna esquerda: formulário "Publicar Agent" (versão, pacote, checksum, force, botão)
   - Coluna direita: "Status dos Agents" (cards verde/amarelo + lista de desatualizados mostrando apenas `Agent vX.Y.Z`)
   - Repetir o mesmo padrão abaixo para Supervisor

4. **Status dos Agents** mostra apenas badges de `Agent vX.Y.Z` (sem Sup)
5. **Status dos Supervisors** mostra apenas badges de `Sup vX.Y.Z` (sem Agent)

### Estado a adicionar

```typescript
const [supervisorStats, setSupervisorStats] = useState<{
  total: number;
  upToDate: number;
  outdated: { name: string; supervisorVersion: string; client: string; }[];
}>({ total: 0, upToDate: 0, outdated: [] });
```

### Modificar `loadAgentStats`

Separar a lógica de filtragem para computar `agentStats` (baseado só em `agent_version`) e `supervisorStats` (baseado só em `supervisor_version`) independentemente.

