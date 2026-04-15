

## Plano — Atualizar remetente e redesign visual do email

### 1. Corrigir nome do remetente

**Arquivo**: `supabase/functions/send-transactional-email/index.ts`

- Linha 8: trocar `SITE_NAME = "iscope-teste"` para `SITE_NAME = "Domain Security"`
- Isso corrige o `From: Domain Security <noreply@notify.domainsecurity.online>`

### 2. Redesign visual do email para acompanhar a landing page

**Arquivo**: `supabase/functions/_shared/transactional-email-templates/domain-security-report.tsx`

Baseado no segundo print (landing page Domain Security), o email deve adotar:

- **Header**: fundo branco (não dark), com ícone de escudo azul (#2563EB) + "Domain Security" em azul escuro (#1e293b), tipografia moderna Inter/sans-serif (não monospace)
- **Cores primárias**: azul (#2563EB) como cor principal, tons de cinza (#64748b, #94a3b8) para texto secundário
- **Botões CTA**: azul (#2563EB) com border-radius arredondado, igual ao "Solicite uma Demo" da landing
- **Layout geral**: fundo branco limpo, cards com bordas suaves, sem fundo escuro no header
- **Footer**: clean, cinza claro, texto discreto
- **Scores e badges**: manter o conteúdo mas com visual mais clean e alinhado ao azul da marca

### 3. Deploy

- Redeploy `send-transactional-email`

### Arquivos

| Arquivo | Acao |
|---|---|
| `send-transactional-email/index.ts` | `SITE_NAME` → "Domain Security" |
| `domain-security-report.tsx` | Redesign completo alinhado a landing page |
| Deploy | `send-transactional-email` |

