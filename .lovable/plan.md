

## Plano: Landing Page Dominio Externo — Pasta Isolada

Todos os arquivos serao criados dentro de `landing-domain-security/`, uma pasta na raiz do projeto totalmente separada do `src/`. Nenhum arquivo existente sera modificado.

### Estrutura

```text
landing-domain-security/
  src/
    App.tsx
    main.tsx
    index.css
    pages/
      Index.tsx
    components/
      Header.tsx
      HeroSection.tsx
      ProblemSection.tsx
      FeaturesSection.tsx
      MonitoringSection.tsx
      HowItWorksSection.tsx
      ScoreSection.tsx
      DemoSection.tsx
      PricingSection.tsx
      FaqSection.tsx
      CtaSection.tsx
      Footer.tsx
      ui/
        Button.tsx
        Card.tsx
  index.html
  tailwind.config.ts
  package.json
```

### Conteudo e secoes

Identico ao plano anterior aprovado:

1. **Hero** — CTA "Solicite uma Demo" e "Ver Planos"
2. **Problema** — 3 dores (certificados, DNS, subdominios)
3. **Funcionalidades** — Grid com DNS, SSL/TLS, Headers, SPF/DKIM/DMARC, DNSSEC, subdominios, takeover
4. **Monitoramento de Ativos** — Certificados, WHOIS, score historico, dashboard, agendamento
5. **Como Funciona** — 3 passos
6. **Score e Compliance** — Sistema 0-100
7. **Demo** — 1 dominio gratuito com analise reduzida
8. **Pricing** — Foco mensal: Starter R$166,58/mes, Professional R$208,25/mes, Enterprise R$308,25/mes, Custom sob consulta
9. **FAQ**
10. **CTA Final**

### Regras

- Zero imports de `@/` ou `src/` do projeto principal
- Componentes UI proprios dentro de `landing-domain-security/src/components/ui/`
- Visual escuro/cyber com gradientes azul/verde neon (identidade iSCOPE)
- framer-motion + lucide-react como dependencias
- Responsivo mobile-first
- Palavra "Trial" nunca usada — sempre "Demo"
- Apos criacao, o usuario copia a pasta para o projeto separado

