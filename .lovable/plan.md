

## Remover submenus e páginas de CVEs do Firewall e Microsoft 365

### Alterações

**1. `src/components/layout/AppLayout.tsx`**
- Remover linha 124: `{ label: 'CVEs', href: '/scope-firewall/cves', icon: ShieldCheck }`
- Remover linha 144: `{ label: 'CVEs', href: '/scope-m365/cves', icon: ShieldCheck }`

**2. `src/App.tsx`**
- Remover lazy import `FirewallCVEsPage` (linha 38)
- Remover lazy import `M365CVEsPage` (linha 70)
- Remover rota `/scope-firewall/cves` (linha 132)
- Remover rota `/scope-m365/cves` (linha 168)

**3. Deletar arquivos**
- `src/pages/firewall/FirewallCVEsPage.tsx`
- `src/pages/m365/M365CVEsPage.tsx`

A página centralizada `/cves` e as fontes `/cves/sources` continuam existindo normalmente.

