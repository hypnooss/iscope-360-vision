

## Cards de Política Clicáveis com Sheet de Detalhes

### Resumo
Tornar os 5 cards de status de política (Anti-Spam, Anti-Phishing, Safe Links, Safe Attachments, Malware Filter) clicáveis, abrindo uma Sheet lateral (50vw) com explicação detalhada de por que a política está no estado atual (ativo, fraco ou desativado) e recomendações de correção.

### Alterações

**Arquivo: `src/components/m365/exchange/ExchangeThreatProtectionSection.tsx`**

1. Adicionar estado `selectedPolicy` para controlar qual card foi clicado.
2. Tornar o `PolicyCard` clicável com `cursor-pointer` e `onClick`.
3. Remover o ícone de link externo (não solicitado).
4. Criar um componente `PolicyDetailSheet` dentro do mesmo arquivo (ou separado) usando o padrão existente de Sheet 50vw.

**Conteúdo da Sheet por política:**

Cada política terá um mapa estático de explicações baseado no status (`enabled`, `weak`, `disabled`), contendo:
- **Título** e **Badge de status** (Ativo/Fraco/Desativado)
- **O que é**: Descrição da função da política
- **Status atual**: Explicação do porquê está naquele estado (baseado na lógica real do backend):
  - Anti-Spam `weak`: "A ação para High Confidence Phish está configurada como 'Mover para Junk' ou 'Adicionar X-Header' em vez de 'Quarentena', reduzindo a eficácia."
  - Anti-Phishing `weak`: "Spoof Intelligence está desabilitado em uma ou mais políticas."
  - Safe Links `disabled`: "Nenhuma política Safe Links configurada ou todas desabilitadas para email."
  - Safe Attachments `disabled`: "A ação está definida como 'Allow' ou a política está desabilitada."
  - Malware Filter `weak`: "O File Filter (Common Attachment Types Filter) está desabilitado."
- **Recomendação**: Ação sugerida para corrigir
- **Referência Microsoft**: Link para documentação oficial

A Sheet seguirá o padrão visual existente (ScrollArea, header com ícone colorido, seções com cards internos).

### Estrutura técnica

```text
ExchangeThreatProtectionSection
├── PolicyCard (agora clicável, sem ExternalLink)
└── PolicyDetailSheet (Sheet 50vw)
    ├── Header (ícone + nome + badge status)
    ├── Seção "O que é"
    ├── Seção "Diagnóstico" (por que está weak/disabled)
    ├── Seção "Recomendação"
    └── Link referência Microsoft
```

Nenhuma alteração de backend necessária — as explicações são derivadas da lógica de avaliação já existente no `m365-analyzer`.

