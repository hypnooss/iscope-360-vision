
## Objetivo
Deixar o card de informações do **Domínio Externo** com a mesma “harmonia” visual do card do **FortiGate**, mantendo o formato **“Título: Valor”** com ícones, mas com tipografia e espaçamento equivalentes ao padrão já usado em `src/components/Dashboard.tsx`.

---

## Diagnóstico (por que está “estranho”)
Comparando com o FortiGate (print 2) vs Domínio Externo (print 1), os principais pontos que quebram a harmonia são:

1) **Tipografia diferente**
- FortiGate usa `label` em `text-sm` e valores com “peso” mais consistente (`font-medium`/`font-semibold`).
- Domínio Externo está usando `label` em `text-xs`, que fica “pequeno demais” e com aparência de “legenda”.

2) **Densidade/respiração do grid**
- FortiGate usa `gap-y-1.5` (bem “apertado, mas elegante”) e `gap-x-6`.
- Domínio Externo está em `gap-y-4`, dando um espaçamento vertical mais alto, que pode passar sensação de “blocos soltos”.

3) **Truncamento/width**
- No FortiGate, apenas alguns campos truncam (e isso ajuda a leitura).
- No Domínio Externo, como NS é muito longo, precisamos truncar, mas manter a linha com a mesma altura/ritmo dos demais.

---

## O que será alterado
Arquivo: `src/pages/external-domain/ExternalDomainAnalysisReportPage.tsx`

### 1) Ajustar `InfoRow` para “bater” com o padrão do FortiGate
Hoje (Domínio Externo):
- `label` em `text-xs`
- `value` em `font-medium`
- `gap-2` ok, mas “peso visual” não está igual ao FortiGate

Mudança proposta:
- **Label**: trocar para `text-sm` (igual ao FortiGate), mantendo `text-muted-foreground` e `whitespace-nowrap`
- **Value**: trocar para `font-medium`/`font-semibold` dependendo do campo:
  - Domínio / NS: `font-semibold` (fica mais parecido com o “Nome” no FortiGate, que destaca o principal)
  - SOA / SOA Contact / DNSSEC Status: `font-medium`
- Manter `min-w-0 flex-1` no valor para truncamento correto
- Manter tooltip apenas quando necessário (NS sempre tem tooltip via `TruncatedText`; DNSSEC notes via tooltip)

Implementação (conceito, sem código final):
- `label` com classes no estilo do FortiGate: `text-muted-foreground text-sm`
- `value` com `font-medium text-foreground` e ajuste de `font-semibold` opcional via prop

### 2) Tornar o grid “mais compacto” (mais harmônico)
No container do grid do card info (onde ficam os `InfoRow`):
- Ajustar `gap-y-4` para **`gap-y-1.5`** (igual ao FortiGate)
- Manter `gap-x-6` (já está)
- Ajustar o breakpoint para casar com FortiGate:
  - FortiGate usa `sm:grid-cols-2`
  - Domínio Externo hoje usa `md:grid-cols-2`
  - Proposta: mudar para `sm:grid-cols-2` para “abrir” 2 colunas mais cedo, igual ao FortiGate (isso dá sensação de consistência entre módulos)

### 3) Melhorar o alinhamento vertical (detalhe que dá “acabamento”)
Adicionar ajuste leve para evitar desalinhamento entre linhas quando o valor está truncado:
- Garantir `leading-none` ou `leading-tight` consistente no `InfoRow` (principalmente no valor truncado)
- Manter ícone com `flex-shrink-0` e label fixo, valor flexível

### 4) DNSSEC Status continua curto
Confirmar e garantir:
- **Somente “Ativo” / “Inativo”** como valor
- Tooltip (se existir) apenas com notes, sem texto grande na linha

---

## Passo a passo de implementação
1) Atualizar o `InfoRow` local:
   - mudar `label` para `text-sm`
   - permitir “peso” do valor (ex.: `valueClassName` opcional para Domínio/NS)
   - garantir `min-w-0 flex-1` e truncamento estável
2) Ajustar o grid do card info:
   - `md:grid-cols-2` → `sm:grid-cols-2`
   - `gap-y-4` → `gap-y-1.5`
3) Revisar visualmente com base nos prints:
   - conferir ritmo de linhas (altura semelhante ao FortiGate)
   - conferir truncamento + tooltip no NS
   - conferir mobile (1 coluna) sem “esmagar”

---

## Critérios de aceite
- Visual do card de info do Domínio Externo fica tão “harmônico” quanto o do FortiGate:
  - mesma escala de fonte para títulos (`text-sm`)
  - espaçamento vertical compacto (`gap-y-1.5`)
  - destaque do campo principal (Domínio/NS) com peso semelhante ao “Nome” no FortiGate
- “DNSSEC Status” aparece curto (Ativo/Inativo), sem texto grande
- Truncamento de NS funciona e tooltip mostra completo

---

## Teste (end-to-end / UI)
1) Abrir um relatório de Domínio Externo com NS longo
2) Validar Desktop:
   - alinhamento das colunas
   - ritmo/altura das linhas semelhante ao FortiGate
3) Validar Mobile:
   - 1 coluna, sem overflow
4) Hover/focus:
   - tooltip do NS e tooltip de notes do DNSSEC (se houver) funcionando
