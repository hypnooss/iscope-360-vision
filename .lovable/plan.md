

## Plano — Melhorias no Email Demo, Links de PDF e Ofuscação

### Resumo

Quatro alterações: (1) redesign do email removendo menções a "iScope 360", (2) dois botões de download direto no email (Compliance + Surface), (3) mostrar amostra de CVEs no PDF Demo do Surface Analyzer, (4) melhorar a ofuscação nos PDFs Demo para parecer um blur real com dados visíveis mas ilegíveis.

### 1. Email — Redesign e remoção do "iScope 360"

**Arquivo**: `supabase/functions/_shared/transactional-email-templates/domain-security-report.tsx`

- Trocar `SITE_NAME` de "iScope360" para "Precisio" ou "Domain Security"
- Header: remover "iScope360" e "Domain Security Report", usar algo como "Relatório de Segurança" com branding "Precisio"
- Footer: remover menção a iScope360
- Adicionar nova prop `compliancePdfUrl` e `surfacePdfUrl`
- Substituir o botão único "Baixar Relatório Completo" por **dois botões CTA**: "Baixar PDF Compliance (Demo)" e "Baixar PDF Surface Analyzer (Demo)"
- Manter banner Demo, scores, findings e stats

### 2. Gerar URLs dos PDFs no backend

**Arquivos**: `supabase/functions/process-api-jobs/index.ts` + `supabase/functions/resend-pipeline-report/index.ts`

- A página pública já gera PDFs client-side, então os dois botões do email apontarão para a mesma `reportUrl` (página `/report/:token`) mas com anchors ou query params para auto-download: `reportUrl + '?download=compliance'` e `reportUrl + '?download=surface'`
- Alternativamente (mais simples): manter os dois botões apontando para a mesma página pública, diferenciando apenas o label ("Ver Relatório Compliance" e "Ver Relatório Surface")
- Passar `reportUrl` como base e o template gera os dois links

### 3. Surface Analyzer Demo — Mostrar amostra de CVEs

**Arquivo**: `src/components/pdf/SurfaceAnalyzerPDFDemo.tsx`

- Após os Assets Descobertos, adicionar seção "Vulnerabilidades Encontradas (amostra)" mostrando até 5 CVEs do `snapshot.cve_matches`
- Mostrar: CVE ID, severity badge, score, título — **sem vincular ao IP/asset**
- Após os 5, texto "e mais X vulnerabilidades..." para gerar curiosidade
- Páginas ofuscadas continuam depois

### 4. Melhorar ofuscação nos PDFs Demo

**Arquivos**: `src/components/pdf/ExternalDomainPDFDemo.tsx` + `src/components/pdf/SurfaceAnalyzerPDFDemo.tsx`

O problema atual: emoji "🔒" não renderiza em `@react-pdf/renderer` (aparece como "=&"), e o conteúdo ofuscado usa blocos genéricos cinza com opacidade 0.06 — muito vazio.

**Solução**:
- Remover o emoji "🔒" (não suportado em react-pdf), substituir por texto "[BLOQUEADO]" ou um ícone SVG de cadeado via `Svg`/`Path`
- Aumentar opacidade do conteúdo "blurred" de 0.06 para ~0.15-0.20 — visível o suficiente para ver que tem dados, mas ilegível
- Adicionar mais linhas/blocos simulados com variação de largura (40%, 70%, 90%, 55%) para parecer texto real
- Overlay: manter fundo semi-transparente branco mas com efeito mais sutil (`rgba(255,255,255,0.65)`)
- Overlay box: trocar emoji por texto "VERSÃO DEMO" com estilo bold + ícone SVG de lock
- Texto do overlay: "Conteúdo disponível na versão completa — adquira o relatório para acessar todos os detalhes"

### Arquivos

| Arquivo | Ação |
|---|---|
| `domain-security-report.tsx` | Redesign: remover iScope360, dois CTAs |
| `process-api-jobs/index.ts` | Passar `reportUrl` (sem mudança, links baseados no mesmo URL) |
| `resend-pipeline-report/index.ts` | Idem |
| `SurfaceAnalyzerPDFDemo.tsx` | Adicionar amostra CVEs + melhorar ofuscação |
| `ExternalDomainPDFDemo.tsx` | Melhorar ofuscação |
| Deploy | `send-transactional-email` |

