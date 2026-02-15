

# Cores Personalizadas nos Icones do TimelineSection

## Mudanca

Atualizar o componente `TimelineSection` para aceitar uma prop `iconBorderColor` que controla a cor da borda e fundo do icone. Atualizar as chamadas:

- **Portas Abertas**: icone laranja/ambar, borda laranja (`border-orange-400/40 bg-orange-400/10`)
- **Servicos & Tecnologias**: icone azul, borda azul (`border-blue-400/40 bg-blue-400/10`, `text-blue-400`)
- **Certificados TLS**: sem mudanca (mantém primary)

## Detalhes tecnicos

### Arquivo: `src/pages/external-domain/AttackSurfaceAnalyzerPage.tsx`

1. Adicionar prop `iconBorderClass` ao `TimelineSection` (default: `"border-primary/40 bg-primary/10"`)

2. No componente, substituir as classes fixas `border-primary/40 bg-primary/10` pelo valor da prop

3. Atualizar chamadas:
   - Portas Abertas: `iconColor="text-orange-400"` + `iconBorderClass="border-orange-400/40 bg-orange-400/10"`
   - Servicos: `iconColor="text-blue-400"` + `iconBorderClass="border-blue-400/40 bg-blue-400/10"`
   - Certificados TLS: sem alteracao (usa default primary)

