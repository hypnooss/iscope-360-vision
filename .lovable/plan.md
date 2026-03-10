

## Ajustar tooltips dos pontos no mapa e bandeiras no fullscreen

### Problema
1. Os tooltips nos pontos do mapa (ao passar o mouse) exibem "Falha Auth FW" e "Sucesso Auth FW" — termos de firewall — mesmo quando usado pelo Entra ID
2. As bandeiras no painel lateral do fullscreen já funcionam (o código usa `getCountryCode` + `fi fi-{code}`), mas os tooltips dos pontos do mapa precisam refletir os labels corretos

### Alterações

**1. `src/components/firewall/AttackMap.tsx`**
- Adicionar prop opcional `labelMap?: { authFailed?: string; authSuccess?: string; ... }` à interface `AttackMapProps`
- Nas linhas 183-186, usar os labels do `labelMap` em vez dos hardcoded:
  - `'Sucesso Auth FW'` → `labelMap?.authSuccess ?? 'Sucesso Auth FW'`
  - `'Sucesso Auth VPN'` → `labelMap?.authSuccessVpn ?? 'Sucesso Auth VPN'`
  - `'Falha Auth FW'` → `labelMap?.authFailed ?? 'Falha Auth FW'`
  - `'Falha Auth VPN'` → `labelMap?.authFailedVpn ?? 'Falha Auth VPN'`

**2. `src/components/m365/entra-id/EntraIdLoginMap.tsx`**
- Passar `labelMap={ENTRA_LABEL_MAP}` ao `AttackMap` (tanto no inline quanto no fullscreen já passa)

**3. `src/components/firewall/AttackMapFullscreen.tsx`**
- Passar `labelMap` ao `AttackMap` interno para que os tooltips no fullscreen também usem os labels corretos

