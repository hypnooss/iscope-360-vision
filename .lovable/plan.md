

## Plano: Adicionar informação de licenciamento nas Sheets de Safe Links e Safe Attachments

### O que será feito

Adicionar uma nova seção **"Licenciamento Necessário"** nas janelas laterais (Sheet) dos cards **Safe Links** e **Safe Attachments**, informando que esses recursos fazem parte do **Microsoft Defender for Office 365** e requerem licenciamento específico.

### Mudança

**Arquivo:** `src/components/m365/exchange/ExchangeThreatProtectionSection.tsx`

1. **Adicionar campo `licensing` opcional no `POLICY_DETAILS`** para `safeLinks` e `safeAttach`:

```ts
licensing: {
  text: 'Safe Links e Safe Attachments fazem parte do Microsoft Defender for Office 365 e requerem licenciamento específico.',
  plans: [
    { name: 'Defender for Office 365 Plan 1', safeLinks: true, safeAttachments: true },
    { name: 'Defender for Office 365 Plan 2', safeLinks: true, safeAttachments: true },
    { name: 'Microsoft 365 E5', safeLinks: true, safeAttachments: true },
    { name: 'Microsoft 365 E5 Security', safeLinks: true, safeAttachments: true },
    { name: 'Microsoft 365 Business Premium', safeLinks: true, safeAttachments: true },
  ],
  note: 'O Plan 2 adiciona recursos avançados como Threat Explorer, Automated Investigation and Response, Campaign view e Attack simulation. Mas Safe Links e Safe Attachments já existem no Plan 1.',
  url: 'https://learn.microsoft.com/pt-br/defender-office-365/mdo-about',
}
```

2. **Renderizar a seção no `PolicyDetailSheet`** — após a Recomendação e antes do link de referência, adicionar um Card com:
   - Ícone de licença (ex: `ShieldCheck` ou `FileKey`)
   - Título "Licenciamento Necessário"
   - Texto explicativo
   - Tabela compacta com as licenças e checkmarks
   - Nota sobre Plan 1 vs Plan 2
   - Link para documentação de licenciamento

A seção só será renderizada quando `detail.licensing` existir (apenas para safeLinks e safeAttach).

### Estilo

Seguir o padrão minimalista existente: `glass-card border`, textos `text-sm`, tabela simples com `text-muted-foreground`. Checkmarks em `text-emerald-400`.

