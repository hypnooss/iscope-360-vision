

## Ajustar Mapa Entra ID: ponto central + legendas fullscreen

### Problema
1. Sem `firewallLocation`, o `AttackMap` não renderiza projectiles animados
2. O `AttackMapFullscreen` exibe labels de firewall ("Falha Auth FW", "Firewall", etc.) no painel lateral e barra inferior

### Alterações

**1. `src/components/m365/entra-id/EntraIdLoginMap.tsx`**
- Definir um ponto fictício no Brasil como destino: `{ lat: -15.8, lng: -47.9, label: 'Entra ID' }`
- Passar `firewallLocation` ao `AttackMap` (inline) e ao `AttackMapFullscreen` (fullscreen)

**2. `src/components/firewall/AttackMapFullscreen.tsx`**
- Adicionar prop opcional `customSections` e `customBottomStats` (ou mais simples: uma prop `mode?: 'firewall' | 'entra-id'`) para controlar quais seções e labels aparecem
- Abordagem mais limpa: adicionar prop `legendOverride?: { sections: {...}[]; bottomStats: {...}[] }` que, quando presente, substitui as seções e stats padrão
- Quando chamado pelo Entra ID, exibir apenas:
  - Painel direito: "FALHA LOGIN" (vermelho) + "SUCESSO LOGIN" (verde) com rankings por país
  - Barra inferior: "Login com Falha" + "Login com Sucesso" + "Entra ID" (em vez de "Firewall")

**Alternativa mais simples (preferida):** adicionar uma prop `labelMap` opcional ao fullscreen:
```ts
labelMap?: {
  authFailed?: string;    // default: "Falha Auth FW"
  authSuccess?: string;   // default: "Sucesso Auth FW"  
  centerPoint?: string;   // default: "Firewall"
}
```

Isso permite que o `EntraIdLoginMap` passe:
```ts
labelMap={{
  authFailed: 'Login com Falha',
  authSuccess: 'Login com Sucesso',
  centerPoint: 'Entra ID'
}}
```

O fullscreen automaticamente ocultará seções com total 0 (VPN, Outbound), mostrando apenas as relevantes com os labels corretos.

