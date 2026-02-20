
# Renomear Cards e Aumentar Sheet Lateral

## Alteracoes

### 1. Renomear "Achados Prioritarios" para "Servicos Expostos"

**Arquivo: `src/components/surface/TopFindingsList.tsx`**
- Titulo do card: "Achados Prioritarios" -> "Servicos Expostos"
- Botao inferior: "Ver todos os achados" -> "Ver todos os servicos expostos"

### 2. Renomear "Visao Geral" para "Grafico de Exposicao"

**Arquivo: `src/components/surface/SeverityTechDonut.tsx`**
- Titulo do card: "Visao Geral" -> "Grafico de Exposicao"

### 3. Aumentar largura do Sheet lateral para 50%

**Arquivo: `src/components/surface/CategoryDetailSheet.tsx`**
- Alterar classes de largura do SheetContent de `sm:max-w-xl lg:max-w-2xl` para `sm:max-w-[50vw]`
- Isso faz o painel lateral ocupar metade da tela em telas maiores

### 4. Renomear textos na pagina de todos os achados

**Arquivo: `src/pages/external-domain/AllFindingsPage.tsx`**
- Breadcrumb: "Todos os Achados" -> "Servicos Expostos"
- Titulo: "Todos os Achados" -> "Servicos Expostos"

### 5. Renomear badge no Sheet

**Arquivo: `src/components/surface/CategoryDetailSheet.tsx`**
- Badge: "X achado(s)" -> "X servico(s) exposto(s)"
