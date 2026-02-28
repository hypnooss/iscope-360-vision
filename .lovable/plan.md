

## Padronizar ícones dos submenus e reposicionar Analyzer no M365

### Arquivo: `src/components/layout/AppLayout.tsx`

**1. Firewall — Corrigir ícone do Analyzer**
- Linha 121: trocar `icon: Activity` para `icon: Radar` (igual ao External Domain)

**2. M365 — Corrigir ícone do Analyzer + reposicionar**
- Linha 143: trocar `icon: Activity` para `icon: Radar`
- Mover o item `Analyzer` para entre `Compliance` e `CVEs`

**Resultado final dos items M365:**
```
Compliance → FileText
Analyzer → Radar
CVEs → ShieldCheck
Entra ID → Shield
Exchange Online → Mail
Execuções → Activity
```

**Resultado final dos items Firewall:**
```
Compliance → FileText
Analyzer → Radar
CVEs → ShieldCheck
Execuções → Activity
```

Padrão consistente: `Analyzer` sempre usa `Radar`, `Execuções` sempre usa `Activity`.

