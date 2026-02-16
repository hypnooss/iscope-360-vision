

# Ajustar Breadcrumb e Coluna Score em Dominios Externos

## Mudancas

### 1. Breadcrumb em ExternalDomainListPage
Atualizar o breadcrumb para exibir corretamente: `Dominio Externo > Dominios`
(Atualmente ja esta assim, mas vou confirmar que esta no padrao correto.)

### 2. Coluna "Ultimo Score" - estilo visual
Na tabela de `ExternalDomainListPage`, a coluna ja se chama "Ultimo Score" (linha 507). Porem o valor e exibido como numero simples (ex: `83`). Ajustar para o padrao da tela Compliance:
- Exibir com icone `CheckCircle` (score >= 75) ou `AlertTriangle` (score < 75)
- Formato com `%` (ex: `83%`)
- Usar as mesmas classes de cor da Compliance: `bg-teal-500/20 text-teal-400 border-teal-500/30` para >= 75, `bg-warning/20 text-warning border-warning/30` para >= 50, `bg-destructive/20 text-destructive border-destructive/30` para < 50

### 3. Coluna "Score" em ExternalDomainReportsPage
Renomear o header da coluna de "Score" para "Ultimo Score" (linha 484).

## Detalhes tecnicos

### Arquivo: `src/pages/external-domain/ExternalDomainListPage.tsx`

**Imports a adicionar**: `CheckCircle, AlertTriangle` (de lucide-react)

**Funcao `getScoreColor`** (linhas 67-72): Substituir pelos mesmos thresholds e classes da Compliance:
- >= 75: `bg-teal-500/20 text-teal-400 border-teal-500/30`
- >= 50: `bg-warning/20 text-warning border-warning/30`
- < 50: `bg-destructive/20 text-destructive border-destructive/30`

**Celula de score** (linhas 537-544): Adicionar icone condicional (`CheckCircle` ou `AlertTriangle`) e sufixo `%` no valor, identico ao `ExternalDomainReportsPage` (linhas 508-519).

### Arquivo: `src/pages/external-domain/ExternalDomainReportsPage.tsx`

**Linha 484**: Renomear `<TableHead>Score</TableHead>` para `<TableHead>Ultimo Score</TableHead>`.

