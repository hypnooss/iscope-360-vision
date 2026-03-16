

## Plano: Enriquecer a Landing Page com Conteudo Atualizado

### Contexto

A landing page atual tem 6 seções (Hero, Problem/Numbers, 4-Step Flow, Features, Testimonials, CTA). A Maze tem seções adicionais com conteudo mais profundo: falsos positivos, timeline de exploits, backlog crescente, blog/recursos, logos de clientes, e uma narrativa mais completa sobre o problema vs. solucao.

Vou adicionar 3 novas seções com dados reais de 2025 e melhorar os dados existentes, mantendo a mesma estética premium e o padrao `SectionReveal`.

---

### Mudancas no arquivo `src/pages/Index.tsx`

**1. Atualizar dados da seção "Problem" com estatísticas 2025**

Substituir os numeros atuais por dados mais recentes e impactantes:
- **21,500+** CVEs publicados so no primeiro semestre de 2025 (recorde historico, projecao de 45,000+ no ano)
- **5 dias** tempo medio para exploracao em 2023 (colapsando de 63 dias em 2019)
- **$4.88M** custo medio de um data breach em 2024 (IBM Cost of a Data Breach Report)

**2. Nova seção: "O problema real" (apos Problem/Numbers)**

Inspirada na seção da Maze sobre falsos positivos. Conteudo:
- Titulo: "90% dos alertas sao falsos positivos"
- Subtitulo explicando que equipes gastam tempo com alertas que nao representam risco real
- 3 cards com problemas: "Alertas sem contexto", "Priorizacao manual", "Ferramentas fragmentadas"
- Dados reais: 90% de findings sao falsos positivos quando analisados no contexto (fonte: Maze/industria), equipes gastam 25h/semana em triagem manual

**3. Nova seção: "Frameworks e Compliance" (apos Features)**

Seção mostrando frameworks suportados pelo iScope:
- Grid com logos/badges de frameworks: CIS Benchmarks, NIST CSF, ISO 27001, PCI DSS, SOC 2, LGPD
- Texto: "Verifique conformidade com os principais frameworks do mercado automaticamente"

**4. Nova seção: "Blog / Insights" (antes do CTA final)**

Inspirada na Maze. Cards com artigos simulados sobre segurança:
- "2025: O ano que vulnerabilidades quebraram todos os recordes"
- "Por que CVSS sozinho nao e suficiente para priorizar vulnerabilidades"
- "Compliance nao e segurança: por que checklist nao funciona"
- Cada card com data, categoria (Security/Product), titulo e link

**5. Melhorar seção de Testimonials**

Atualizar depoimentos com personas mais criveis e dados mais concretos, inspirados nos testimonials da Maze (CISOs nomeados, com empresas reais de segmentos variados).

---

### Estrutura final da página (ordem das seções)

```text
1. Hero (existente)
2. Problem — Impact Numbers (atualizado com dados 2025)
3. O Problema Real — Falsos Positivos (NOVA)
4. Como o iScope Resolve — 4 Steps (existente)
5. Features (existente)
6. Frameworks & Compliance (NOVA)
7. Testimonials (melhorado)
8. Blog / Insights (NOVA)
9. CTA Final (existente)
10. Footer (existente)
```

### Detalhes técnicos

- Tudo dentro de `src/pages/Index.tsx` — mesmo padrao de `SectionReveal`, mesma estética
- Novos icones do Lucide: `AlertTriangle`, `Clock`, `Layers`, `BookOpen`, `CheckCircle2`, `Lock`
- Seções novas usam `min-h-screen` conforme padrão da memória de design
- Sem dependencias externas novas
- Cards de blog e frameworks sao estaticos (sem fetch externo)

