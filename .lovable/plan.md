
# Plano: Criar FirewallReportPreview

## Objetivo
Criar uma página de preview similar ao DomainReportPreview, mas adaptada para relatórios de Firewall, usando o mesmo padrão "Command Center Header".

## Arquivo a Criar
`src/pages/preview/FirewallReportPreview.tsx`

## Estrutura do Mock Data (Firewall)

```tsx
const mockData = {
  hostname: "FGT-DATACENTER-01",
  score: 85,
  vendor: "Fortinet",
  model: "FortiGate 200F",
  serial: "FGT200F2R23456789",
  firmware: "v7.4.3 build 2573",
  uptime: "127 dias",
  stats: {
    total: 42,
    passed: 36,
    failed: 6,
  },
  security: {
    adminPasswordChanged: true,
    haEnabled: true,
    syslogConfigured: true,
    vpnActive: false,
  },
};
```

## DetailRows para Firewall

| Label | Valor | Indicador |
|-------|-------|-----------|
| Vendor | Fortinet | - |
| Modelo | FortiGate 200F | - |
| Serial | FGT200F2R23456789 | - |
| Firmware | v7.4.3 build 2573 | - |
| Uptime | 127 dias | - |
| Admin Password | Alterada / Padrão | ● |
| HA Cluster | Ativo / Inativo | ● |
| Syslog | Configurado / Ausente | ● |

## Componentes Reutilizados

Os componentes `MiniStat` e `DetailRow` serão copiados do DomainReportPreview (idênticos).

## Rota a Adicionar

No `App.tsx`:
```tsx
<Route path="/preview/firewall-report" element={<FirewallReportPreview />} />
```

## Diferenças Visuais em Relação ao Domain

1. **Título**: Hostname do firewall (ex: `FGT-DATACENTER-01`)
2. **DetailRows**: Campos específicos de firewall (Vendor, Model, Serial, Firmware, Uptime)
3. **Indicadores de Status**: Admin Password, HA, Syslog (em vez de SPF/DKIM/DMARC)
4. **Notas de Design**: Atualizadas para refletir contexto de firewall

## Arquivos Modificados

1. **Criar**: `src/pages/preview/FirewallReportPreview.tsx`
2. **Editar**: `src/App.tsx` (adicionar rota)
