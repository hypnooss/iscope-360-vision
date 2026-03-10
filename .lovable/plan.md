

## Reposicionar "Exchange Analyzer" no menu M365

Mover o item "Exchange Analyzer" da posição 6 (após Exchange Online) para a posição 2 (logo abaixo de Compliance), conforme solicitado.

### Alteração em `src/components/layout/AppLayout.tsx` (linhas 140-150)

Reordenar o array `items` do módulo `scope_m365`:

```tsx
items: [
  { label: 'Compliance', href: '/scope-m365/compliance', icon: FileText },
  { label: 'Exchange Analyzer', href: '/scope-m365/exchange-analyzer', icon: Mail },
  { label: 'Analyzer', href: '/scope-m365/analyzer', icon: Radar },
  { label: 'CVEs', href: '/scope-m365/cves', icon: ShieldCheck },
  { label: 'Entra ID', href: '/scope-m365/entra-id', icon: Shield },
  { label: 'Exchange Online', href: '/scope-m365/exchange-online', icon: Mail },
  { label: 'Colaboração', href: '/scope-m365/collaboration', icon: Users },
  { label: 'Saúde do 365', href: '/scope-m365/service-health', icon: HeartPulse },
  { label: 'Execuções', href: '/scope-m365/executions', icon: Activity },
],
```

### Arquivo
- `src/components/layout/AppLayout.tsx`

