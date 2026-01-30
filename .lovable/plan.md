
## O que você quis dizer (requisito corrigido)
Você quer o padrão **“título antes do valor”** (ex.: **“Domínio: estrela.com.br”**), mantendo os ícones, e garantindo que o layout não fique desalinhado/esmagado.

Além disso, **DNSSEC Status** deve exibir apenas **“Ativo”** ou **“Inativo”**, com qualquer detalhe/notes somente em tooltip.

---

## Diagnóstico rápido do porquê “esmagou”
Hoje o `InfoRow` está assim (ordem):
- ícone
- **valor** (flexível / truncado)
- **label** (sempre `whitespace-nowrap`)

Isso faz com que, em telas menores/linhas longas, o label fique “colado” e empurre o valor, além de dar sensação de desalinhamento porque o “título” fica no fim.

---

## Mudanças propostas (frontend)
Arquivo: `src/pages/external-domain/ExternalDomainAnalysisReportPage.tsx`

### 1) Refatorar o `InfoRow` para “Título: Valor”
Vou reordenar e ajustar as classes para ficarem previsíveis:

**Nova ordem do row:**
1. Ícone (fixo)
2. **Título** (muted, fixo, com `:`)  
3. **Valor** (flexível, truncado, com tooltip)

**Estrutura sugerida (conceito):**
- container: `flex items-center gap-2 min-w-0`
- ícone: `flex-shrink-0`
- título: `flex-shrink-0 text-xs text-muted-foreground whitespace-nowrap`
- valor: `min-w-0 flex-1`
  - usa `TruncatedText` com `maxWidthClassName="min-w-0 flex-1"` para truncar sem quebrar o grid

Isso garante:
- o título nunca “quebra” (fica estável)
- o valor ocupa o resto da linha e trunca corretamente
- alinhamento consistente entre linhas

### 2) Tooltip (sem poluir) e acessibilidade
Para linhas com `tooltip` (DNSSEC notes), vou manter o tooltip **somente no valor**, não no row inteiro.
- O valor exibido continua curto (Ativo/Inativo)
- Tooltip mostra apenas as notes (se existirem)
- Mantém foco por teclado (`tabIndex={0}`) como já está

### 3) Ajuste fino de espaçamento do grid
O container dos itens está em:
```text
grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3
```
Se ainda ficar “apertado”, vou ajustar levemente:
- `gap-y-3` → `gap-y-4` (mais respiro vertical)
- e/ou `gap-x-8` → `gap-x-6` (menos distância horizontal, reduz chance de compressão)

A decisão final vai ser visual (desktop + mobile) no preview.

---

## DNSSEC Status (confirmando regra)
Já está calculando:
- **Ativo** se `dnssecHasDnskey && dnssecHasDs`
- caso contrário **Inativo**
E o tooltip (`dnssecNotesTooltip`) fica só para notes.
Vou manter exatamente isso; apenas garantir que o texto longo não apareça como valor em nenhum cenário.

---

## Critérios de aceite (o que você vai ver)
1) No card de informações, cada item aparece como:
- **“Domínio: estrela.com.br”**
- **“Nameservers (NS): rachel.ns… , jacob.ns…”** (truncado + tooltip no hover)
- **“SOA: …”**, **“SOA Contact: …”**
- **“DNSSEC Status: Ativo/Inativo”** (curto), com notes só em tooltip (se existirem)

2) Nada “esmagado”:
- o título não invade/empurra
- o valor trunca corretamente em vez de quebrar layout

---

## Plano de execução (passo a passo)
1) Alterar o componente local `InfoRow`:
   - reordenar label/valor para **Título: Valor**
   - ajustar classes (`flex-shrink-0` no título, `min-w-0 flex-1` no valor)
   - manter tooltip apenas no valor quando existir
2) Ajustar o separador “:” no título
3) Ajustar `gap-x/gap-y` do grid se necessário após inspeção visual
4) Validar no preview:
   - Desktop (>= md): 2 colunas
   - Mobile: 1 coluna, truncamento + tooltip funcionando

---

## Testes recomendados (rápidos)
- Abrir o relatório atual na rota informada
- Testar:
  - hover/focus no valor de NS (tooltip mostra completo)
  - DNSSEC Status mostra somente Ativo/Inativo
  - mobile: nada sai do card / sem sobreposição