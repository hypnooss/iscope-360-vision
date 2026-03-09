
# Plano: Enriquecimento Educacional do Firewall Analyzer v2

## Objetivo
Enriquecer a tela do **Firewall Analyzer v2** com insights educacionais que demonstrem a relação entre métricas de segurança observadas (ataques, falhas) e as **boas práticas de compliance**, sem vincular as coletas entre os dois módulos.

## Estratégia: Sistema de "Dicas de Segurança Contextuais"

Ao invés de correlacionar diretamente com regras de compliance (o que criaria acoplamento), vamos criar **cards educacionais** que aparecem quando certos padrões são detectados nos dados do Analyzer. Esses cards explicam:

1. **O que está acontecendo** (baseado nas métricas)
2. **Por que isso é um problema** (contexto de segurança)
3. **Qual boa prática poderia prevenir** (sem mencionar regras específicas, mas sim conceitos gerais)
4. **Impacto no negócio** (dano potencial)

### Exemplo Prático (VPN Bombardeada)

```
┌─────────────────────────────────────────────────────────────┐
│ 💡 Insight de Segurança                                     │
├─────────────────────────────────────────────────────────────┤
│ ⚠️ VPN Exposta a Ataques Globais                           │
│                                                              │
│ Detectadas 590 tentativas de VPN de 23 países diferentes.  │
│                                                              │
│ 🎯 Por que isso acontece?                                   │
│ Quando a VPN aceita conexões de qualquer origem, ela se    │
│ torna um alvo para ataques automatizados de brute-force.   │
│                                                              │
│ ✅ Boa prática recomendada:                                 │
│ • Restringir origens por geolocalização (países)           │
│ • Implementar whitelist de IPs ou redes confiáveis         │
│ • Configurar autenticação multifator (MFA)                 │
│                                                              │
│ 💼 Impacto no negócio:                                      │
│ Credenciais comprometidas podem resultar em acesso não     │
│ autorizado à rede interna e exfiltração de dados.          │
└─────────────────────────────────────────────────────────────┘
```

## Arquitetura da Solução

### 1. Novo Componente: `SecurityInsightCards`

**Arquivo:** `src/components/firewall/SecurityInsightCards.tsx`

- Recebe o `snapshot` do Analyzer
- Aplica **heurísticas educacionais** (regras de negócio simples)
- Retorna array de cards educacionais com:
  - `id`: identificador único
  - `title`: título do insight
  - `severity`: 'critical' | 'high' | 'medium' | 'low'
  - `what`: o que está acontecendo (dados)
  - `why`: por que isso é um risco
  - `bestPractice`: array de boas práticas (bullets)
  - `businessImpact`: impacto para o negócio
  - `metrics`: dados quantitativos de evidência

### 2. Heurísticas Educacionais (8 Padrões)

| Padrão Detectado | Condição (Metrics) | Insight Gerado |
|------------------|-------------------|----------------|
| **VPN Bombardeada** | `vpnFailures > 100` e países únicos `> 5` | Orientação sobre restrição geográfica + MFA |
| **Admin Sob Ataque** | `firewallAuthFailures / totalAuth > 0.5` | Restrição de IP de origem para admin |
| **Port Scan Massivo** | `topBlockedIPs` com > 10 portas diferentes | Importância de firewalls de borda + IDS |
| **Comunicação Botnet** | `botnetDetections > 0` | Segurança DNS + bloqueio de C&C |
| **Anomalias de Tráfego** | `anomalyEvents > 20` | Rate limiting + proteção DDoS |
| **Alta Taxa de Bloqueio** | `totalDenied / totalEvents > 0.7` | Revisão de políticas restritivas vs legítimas |
| **Sessões Persistentes** | `activeSessions > 1000` (se disponível) | Timeout de sessão + políticas de reconexão |
| **Tráfego Saída Bloqueado** | `outboundBlocked > 100` | Políticas de egress + categorização de destinos |

### 3. Posicionamento na UI

**Local:** Após as **AnalyzerStatsCards** e antes do **AnalyzerCategoryGrid**

```tsx
{/* Stats Cards */}
<AnalyzerStatsCards snapshot={snapshot} />

{/* 🆕 Security Insights Cards */}
<SecurityInsightCards snapshot={snapshot} />

{/* Category Grid */}
<AnalyzerCategoryGrid ... />
```

### 4. Visual dos Cards

- **Layout**: Grid responsivo 1-2 colunas (desktop = 2)
- **Cores**: Borda lateral colorida por severidade (vermelho, laranja, amarelo, azul)
- **Ícones**: Ícone educacional por tipo (🎯 Shield, 🔒 Lock, 🌍 Globe)
- **Expansão**: Cards colapsáveis — título + métrica sempre visível, detalhes expandem ao clicar
- **Badge de Severidade**: Pequeno badge no canto superior direito

### 5. Exemplo de Código (Hook)

```typescript
// src/hooks/useSecurityInsights.ts
export function useSecurityInsights(snapshot: AnalyzerSnapshot | null) {
  return useMemo(() => {
    if (!snapshot) return [];
    const insights: SecurityInsight[] = [];
    const m = snapshot.metrics;

    // Heurística 1: VPN Bombardeada
    if (m.vpnFailures > 100) {
      const countries = new Set(
        m.topVpnAuthCountriesFailed?.map(c => c.country) ?? []
      ).size;
      
      if (countries > 5) {
        insights.push({
          id: 'vpn-exposed',
          title: 'VPN Exposta a Ataques Globais',
          severity: 'high',
          icon: 'wifi',
          what: `${m.vpnFailures} tentativas de VPN de ${countries} países diferentes.`,
          why: 'VPNs sem restrição geográfica são alvos constantes de ataques automatizados de força bruta.',
          bestPractice: [
            'Restringir origens por geolocalização (países permitidos)',
            'Implementar whitelist de IPs ou redes confiáveis',
            'Ativar autenticação multifator (MFA) obrigatória',
            'Configurar rate limiting para tentativas de login'
          ],
          businessImpact: 'Credenciais comprometidas podem resultar em acesso não autorizado à rede interna, exfiltração de dados sensíveis e violação de conformidade.',
          metrics: [
            { label: 'Tentativas Falhadas', value: m.vpnFailures },
            { label: 'Países Únicos', value: countries },
          ],
        });
      }
    }

    // Heurística 2: Admin Brute Force
    const totalAuth = (m.firewallAuthSuccesses || 0) + (m.firewallAuthFailures || 0);
    const adminFailRate = totalAuth > 0 ? m.firewallAuthFailures / totalAuth : 0;
    
    if (adminFailRate > 0.5 && m.firewallAuthFailures > 20) {
      insights.push({
        id: 'admin-brute-force',
        title: 'Alta Taxa de Falhas em Acesso Administrativo',
        severity: 'critical',
        icon: 'shield-alert',
        what: `${Math.round(adminFailRate * 100)}% das tentativas de login admin falharam (${m.firewallAuthFailures} falhas).`,
        why: 'Alta taxa de falhas indica tentativas de brute force ou credenciais vazadas.',
        bestPractice: [
          'Restringir acesso admin apenas a IPs internos ou VPN',
          'Nunca expor interface admin via WAN',
          'Implementar bloqueio temporário após N falhas',
          'Usar certificados ou chaves SSH ao invés de senhas'
          ],
        businessImpact: 'Comprometimento de conta admin resulta em controle total do firewall e possível desativação de proteções.',
        metrics: [
          { label: 'Taxa de Falha', value: `${Math.round(adminFailRate * 100)}%` },
          { label: 'Tentativas', value: totalAuth },
        ],
      });
    }

    // Heurística 3: Botnet Detection
    if (m.botnetDetections > 0) {
      insights.push({
        id: 'botnet-c2',
        title: 'Comunicação com Botnets Detectada',
        severity: 'critical',
        icon: 'bug',
        what: `${m.botnetDetections} tentativas de comunicação com servidores C&C de botnets conhecidos.`,
        why: 'Dispositivos internos podem estar comprometidos e sob controle remoto.',
        bestPractice: [
          'Ativar FortiGuard Botnet C&C Detection',
          'Implementar DNS Filtering para bloquear domínios maliciosos',
          'Segmentar rede (VLANs) para limitar propagação',
          'Realizar scan de malware em hosts internos'
        ],
        businessImpact: 'Dispositivos comprometidos podem ser usados para DDoS, mineração de criptomoedas ou exfiltração de dados.',
        metrics: [
          { label: 'Detecções', value: m.botnetDetections },
          { label: 'Domínios Únicos', value: m.botnetDomains?.length ?? 0 },
        ],
      });
    }

    // Heurística 4: Port Scan
    const portScanIPs = (m.topBlockedIPs ?? []).filter(ip => ip.targetPorts.length > 10);
    if (portScanIPs.length > 0) {
      insights.push({
        id: 'port-scan-detected',
        title: 'Port Scans Detectados',
        severity: 'high',
        icon: 'radar',
        what: `${portScanIPs.length} IPs realizaram varredura em múltiplas portas (${portScanIPs[0].targetPorts.length} portas).`,
        why: 'Port scans são a fase de reconhecimento de ataques direcionados.',
        bestPractice: [
          'Configurar IDS/IPS para bloquear port scans',
          'Desabilitar serviços não utilizados em interfaces WAN',
          'Implementar rate limiting em firewalls de borda',
          'Monitorar logs de port scan para identificar padrões'
        ],
        businessImpact: 'Atacantes mapeiam serviços expostos para explorar vulnerabilidades conhecidas.',
        metrics: [
          { label: 'IPs Escaneando', value: portScanIPs.length },
          { label: 'Portas Testadas', value: portScanIPs[0].targetPorts.length },
        ],
      });
    }

    return insights;
  }, [snapshot]);
}
```

### 6. Componente Visual

```tsx
// src/components/firewall/SecurityInsightCards.tsx
export function SecurityInsightCards({ snapshot }: { snapshot: AnalyzerSnapshot }) {
  const insights = useSecurityInsights(snapshot);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (insights.length === 0) return null;

  return (
    <div className="space-y-4 mb-6">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
          💡 Insights de Segurança
        </h2>
        <Badge variant="outline" className="text-xs">
          {insights.length} {insights.length === 1 ? 'insight' : 'insights'}
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {insights.map(insight => (
          <Card
            key={insight.id}
            className={cn(
              "border-l-4 cursor-pointer transition-all hover:shadow-md",
              insight.severity === 'critical' && "border-l-red-500",
              insight.severity === 'high' && "border-l-orange-500",
              insight.severity === 'medium' && "border-l-yellow-500",
              insight.severity === 'low' && "border-l-blue-400"
            )}
            onClick={() => setExpandedId(expandedId === insight.id ? null : insight.id)}
          >
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 flex-1">
                  <DynamicIcon name={insight.icon} className="w-5 h-5 shrink-0" />
                  <CardTitle className="text-sm font-semibold">{insight.title}</CardTitle>
                </div>
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[10px] px-1.5 py-0 shrink-0",
                    insight.severity === 'critical' && "bg-red-500/20 text-red-500 border-red-500/30",
                    insight.severity === 'high' && "bg-orange-500/20 text-orange-500 border-orange-500/30",
                    insight.severity === 'medium' && "bg-yellow-500/20 text-yellow-500 border-yellow-500/30",
                    insight.severity === 'low' && "bg-blue-400/20 text-blue-400 border-blue-400/30"
                  )}
                >
                  {insight.severity}
                </Badge>
              </div>
            </CardHeader>
            
            <CardContent className="space-y-3 pt-0">
              {/* Métricas (sempre visível) */}
              <div className="grid grid-cols-2 gap-2">
                {insight.metrics.map((m, i) => (
                  <div key={i} className="bg-secondary/30 p-2 rounded text-xs">
                    <div className="text-muted-foreground">{m.label}</div>
                    <div className="font-bold text-sm">{m.value}</div>
                  </div>
                ))}
              </div>

              {/* Detalhes expandidos */}
              {expandedId === insight.id && (
                <div className="space-y-3 pt-2 border-t animate-in fade-in slide-in-from-top-2">
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-1">🎯 O que está acontecendo?</p>
                    <p className="text-sm">{insight.what}</p>
                  </div>
                  
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-1">❓ Por que isso é um risco?</p>
                    <p className="text-sm">{insight.why}</p>
                  </div>
                  
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-1.5">✅ Boas práticas recomendadas:</p>
                    <ul className="space-y-1">
                      {insight.bestPractice.map((bp, i) => (
                        <li key={i} className="text-sm flex items-start gap-2">
                          <span className="text-primary shrink-0">•</span>
                          <span>{bp}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-1">💼 Impacto no negócio:</p>
                    <p className="text-sm text-muted-foreground">{insight.businessImpact}</p>
                  </div>
                </div>
              )}

              {/* Indicador de expansão */}
              <div className="flex justify-center pt-1">
                <ChevronDown
                  className={cn(
                    "w-4 h-4 text-muted-foreground transition-transform",
                    expandedId === insight.id && "rotate-180"
                  )}
                />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
```

## Benefícios da Abordagem

1. **Zero Acoplamento**: Não há queries para `compliance_rules` ou dependência de coletas externas
2. **Educacional**: Ensina o usuário sobre boas práticas de segurança
3. **Contextual**: Insights aparecem apenas quando relevantes (dados presentes)
4. **Acionável**: Cada insight oferece passos concretos de remediação
5. **Escalável**: Novas heurísticas podem ser adicionadas facilmente
6. **Valor de Negócio**: Explica o impacto financeiro/operacional do risco

## Arquivos a Criar/Modificar

### Novos:
- `src/hooks/useSecurityInsights.ts` (hook com heurísticas)
- `src/components/firewall/SecurityInsightCards.tsx` (componente visual)
- `src/types/securityInsights.ts` (tipos TypeScript)

### Modificados:
- `src/pages/firewall/AnalyzerDashboardV2Page.tsx` (integrar componente)

## Próximos Passos Após Aprovação

1. Criar estrutura de tipos para insights educacionais
2. Implementar hook `useSecurityInsights` com 8 heurísticas iniciais
3. Desenvolver componente visual `SecurityInsightCards`
4. Integrar na página v2 entre Stats e Category Grid
5. Testar com dados reais do workspace Precisio
