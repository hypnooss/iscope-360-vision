

## Plano — Gerar PDF no pipeline e enviar link por email

O email atualmente chega apenas com um resumo visual inline (HTML). O usuário quer receber um **PDF completo** como entregável, e o email deve funcionar como um **teaser/demo** com informações parcialmente obscurecidas, incentivando o download do PDF completo.

Como o sistema de email do Lovable **não suporta anexos**, a abordagem é:

1. **Gerar o PDF server-side** na Edge Function `process-api-jobs` (step `email_report`)
2. **Upload para Supabase Storage** (bucket `reports`)
3. **Gerar signed URL** com validade de 7 dias
4. **Passar a URL no `templateData.reportUrl`** para o template de email
5. **Redesenhar o template de email** como versão DEMO — scores e findings parcialmente borrados/ofuscados, com CTA "Baixar Relatório Completo (PDF)"

### Detalhes técnicos

**1. Criar bucket `reports` no Supabase Storage** (migration)
- Bucket privado, com policy de leitura via signed URLs

**2. Criar Edge Function `generate-domain-pdf`**
- Recebe `domain_id`, busca todos os dados (compliance, attack surface, DNS, email auth, subdomains, correction guides)
- Usa `@react-pdf/renderer` (Deno-compatible) para gerar o PDF server-side com o mesmo `ExternalDomainPDF` component adaptado para Deno
- Faz upload para `reports/{domain_id}/{job_id}.pdf`
- Retorna a signed URL

**Problema**: `@react-pdf/renderer` depende de Node.js APIs e não roda em Deno/Edge Functions facilmente. Alternativa mais viável:

**2b. Alternativa: Gerar PDF via endpoint da app (client-side trigger) ou via Puppeteer/HTML-to-PDF**

Dado que `@react-pdf/renderer` é complexo para Deno, a abordagem pragmática é:
- Criar uma **rota pública** no app (`/api/reports/:jobId`) que renderiza o relatório completo em HTML
- No `stepEmailReport`, gerar o PDF usando uma lib server-side simples ou simplesmente **linkar para a página do relatório** com token de acesso temporário
- Armazenar um token de acesso único na tabela `api_jobs` para permitir visualização sem login

**3. Atualizar `stepEmailReport`** em `process-api-jobs/index.ts`
- Gerar token de acesso ao relatório
- Salvar no job metadata
- Construir URL do relatório: `https://iscope-teste.lovable.app/report/{token}`
- Passar como `reportUrl` no templateData

**4. Criar página `/report/:token`** no frontend
- Busca dados do job pelo token
- Renderiza `ExternalDomainPDF` com botão de download via `usePDFDownload`
- Versão completa do relatório, sem login necessário

**5. Redesenhar template de email como DEMO**
- Mostrar scores com blur/ofuscação parcial (ex: só o primeiro dígito visível)
- Findings mostra contagem mas não detalhes
- Grande botão CTA: "📄 Baixar Relatório Completo (PDF)"
- Texto: "Este é um resumo. O relatório completo com guia de correções está disponível no link abaixo."

### Arquivos envolvidos

| Arquivo | Ação |
|---|---|
| `supabase/functions/process-api-jobs/index.ts` | Gerar token, construir reportUrl, passar no templateData |
| `supabase/functions/_shared/transactional-email-templates/domain-security-report.tsx` | Redesenhar como versão DEMO com blur e CTA |
| `src/pages/PublicReport.tsx` | Nova página pública para visualizar/baixar PDF |
| `src/App.tsx` | Adicionar rota `/report/:token` |
| Migration SQL | Adicionar coluna `access_token` na tabela `api_jobs` |

### Fluxo final

```text
Pipeline completa
  → stepEmailReport gera token único
  → Salva token no job
  → Envia email DEMO com link /report/{token}
  → Destinatário clica no link
  → Página pública carrega dados e oferece download do PDF completo
```

