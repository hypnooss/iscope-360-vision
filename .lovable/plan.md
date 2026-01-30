
## Objetivo do ajuste (UI do card de informações)
1) Reverter o layout do card de informações para o padrão “**valor à frente do título**” (em linha), evitando o visual “em coluna (título em cima / valor embaixo)” que ficou estranho/esmagado.
2) Simplificar **DNSSEC Status** para exibir apenas **“Ativo”** ou **“Inativo”** (sem o texto longo). Opcionalmente manter as *notes* apenas em tooltip (sem poluir o layout).

---

## O que vou mudar (alto nível)
### 1) `src/pages/external-domain/ExternalDomainAnalysisReportPage.tsx`
#### 1.1. Reorganizar o bloco “Parte superior: Info”
Hoje está assim:
- `<dl>` com `<dt>` em cima e `<dd>` embaixo, em grid 2 colunas.

Vamos trocar para itens em formato “linha”:
- Cada informação vira um “row” com:
  - ícone pequeno
  - **valor (forte, truncado com tooltip)**
  - **título (muted, menor)**
- Exemplo visual (conceito):
  - `[icon] estrela.com.br   Domínio`
  - `[icon] jacob..., rachel...   Nameservers (NS)`
  - `[icon] jacob.ns.cloudflare.com   SOA`
  - `[icon] dns@cloudflare.com   SOA Contact`
  - `[icon] Ativo   DNSSEC Status`

Isso atende exatamente “valores a frente do título”.

#### 1.2. Garantir alinhamento e evitar “esmagar”
Para não ficar desalinhado/espremido:
- Usar `grid` responsivo com **2 colunas no desktop** e **1 coluna no mobile**:
  - `grid-cols-1 md:grid-cols-2`
- Cada item terá:
  - `min-w-0` no container
  - um `flex items-center gap-2` interno
  - o valor com `TruncatedText` usando `maxWidthClassName="min-w-0 flex-1"` (para truncar corretamente sem quebrar o layout)
- Ajustar espaçamentos:
  - `gap-x-8 gap-y-3` ou `gap-4` conforme necessário para “respirar” melhor.

#### 1.3. DNSSEC Status: apenas “Ativo” / “Inativo”
Hoje:
- O UI usa `dnssecTooltip` que concatena `status + notes`, o que cria aquele texto gigante.

Novo comportamento:
- `dnssecLabel` (texto exibido) = **Ativo** se tiver DNSKEY e DS; caso contrário **Inativo**.
- Se existirem `dnssecNotes`, elas ficam **apenas no tooltip** (hover no status), mas o texto exibido no card permanece curto.
  - Implementação: `TruncatedText` recebe `text={dnssecLabel}` (curto).
  - E podemos colocar um tooltip separado (Radix Tooltip) no ícone/linha, mostrando notes (ou reutilizar `TruncatedText` somente para exibir status e adicionar outro tooltip discreto para notes).
- Se você preferir “sem tooltip nenhum” para DNSSEC, também dá para desligar e mostrar só Ativo/Inativo (mas vou manter tooltip com notes como “debug/auditoria” sem poluir a tela).

---

## Detalhes técnicos (como será implementado)
### A) Criar um pequeno componente interno (no mesmo arquivo) para padronizar as linhas
No `ExternalDomainAnalysisReportPage.tsx`, criar algo como `InfoRow` (local, não precisa arquivo novo):
- Props: `icon`, `label`, `value`, `valueClassName?`, `tooltip?`
- Layout base:
  - `<div className="min-w-0 flex items-center gap-2">`
  - ícone `flex-shrink-0`
  - `<TruncatedText ... className="font-medium ... flex-1 min-w-0" />`
  - `<span className="text-xs text-muted-foreground whitespace-nowrap">Label</span>`

Isso garante consistência entre todas as linhas.

### B) Ajustar `TruncatedText` usage (sem mexer no componente)
- Usar `maxWidthClassName="min-w-0 flex-1"` em vez de `w-full` dentro de flex-row.
- Isso é um detalhe crucial: `w-full` em flex às vezes causa quebra/espremida; `flex-1 min-w-0` tende a ficar perfeito para truncar.

---

## Sequência de execução
1) Alterar o markup do card info em `ExternalDomainAnalysisReportPage.tsx`:
   - Remover `<dl>/<dt>/<dd>` atual
   - Inserir grid de `InfoRow` com “valor antes do título”
2) Ajustar cálculo de DNSSEC:
   - Remover “Parcial”
   - Exibir apenas “Ativo”/“Inativo”
   - Deixar notes apenas em tooltip (se existirem)
3) Revisar responsividade:
   - Desktop: 2 colunas
   - Mobile: 1 coluna, sem quebras estranhas
4) Validação visual no preview.

---

## Critérios de aceite
- Card de info fica visualmente alinhado e legível.
- Cada linha mostra **valor primeiro** e **título depois**, sem ficar “em coluna”.
- Nameservers continuam truncados com “...” e tooltip mostra o texto completo.
- DNSSEC Status aparece só como **Ativo** ou **Inativo** (sem texto longo).

---

## Testes recomendados (E2E/UI)
1) Abrir o relatório atual na rota:
   - `/scope-external-domain/domains/4016b956-6e71-4516-924d-78f88ff7823f/report/41a955ad-7e38-4f16-a448-6f435051c9a3`
2) Verificar no desktop:
   - alinhamento das linhas
   - truncamento de NS funcionando
   - DNSSEC curto (Ativo/Inativo)
3) Verificar no mobile:
   - grid vira 1 coluna
   - nada “esmagado” / overflow
