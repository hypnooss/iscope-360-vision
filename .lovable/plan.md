

## Plano — Download direto no email + Renomear header

### Contexto

Os PDFs demo são gerados **client-side** com `@react-pdf/renderer` (não é possível gerar em Edge Functions Deno). Portanto, a página `/report/:token` continua necessária como motor de geração, mas será transformada numa página de **auto-download** — sem a UI intermediária visível.

### Alterações

**1. PublicReportPage — Auto-download sem UI intermediária**

Arquivo: `src/pages/PublicReportPage.tsx`

- Detectar query param `?download=compliance` ou `?download=surface` na URL
- Quando presente, após carregar os dados, auto-disparar o download do PDF correspondente (chamar `handleDownloadCompliance` ou `handleDownloadSurface` automaticamente)
- Mostrar apenas uma tela minimalista com "Gerando seu relatório..." + spinner enquanto o PDF é gerado, e "Download iniciado!" após
- Sem header "iScope360", sem cards, sem a UI atual — apenas o feedback do download
- Se nenhum `download` param estiver presente, manter a página atual como fallback (mas trocar "iScope360" por "Domain Security" e "Precisio" no footer)

**2. Email — Trocar "Precisio" por "Domain Security"**

Arquivo: `supabase/functions/_shared/transactional-email-templates/domain-security-report.tsx`

- Alterar `SITE_NAME` de `"Precisio"` para `"Domain Security"`
- Os links continuam apontando para `/report/:token?download=compliance` e `?download=surface` — mas agora o usuário verá apenas o download automático, sem a página intermediária

**3. Limpar referências "iScope360" na página pública**

Arquivo: `src/pages/PublicReportPage.tsx`

- Trocar "iScope360" no header por "Domain Security"
- Trocar "Precisio · iScope360" no footer por "Domain Security"
- Trocar prefixo dos filenames de PDF de `iscope360-` para `domainsecurity-`

**4. Deploy**

- Redeploy `send-transactional-email` após alterar o template de email

### Resultado

O destinatário clica no botão do email → abre uma página que **automaticamente gera e baixa o PDF** → vê apenas "Gerando seu relatório..." sem nenhuma UI de branding intermediária. Experiência de download direto.

### Arquivos

| Arquivo | Ação |
|---|---|
| `domain-security-report.tsx` | SITE_NAME → "Domain Security" |
| `src/pages/PublicReportPage.tsx` | Auto-download + limpar branding |
| Deploy | `send-transactional-email` |

