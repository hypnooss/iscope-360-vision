

## Ajustes nos cards de Compliance M365

### Alteracao 1: Remover "itens afetados" do card
No `UnifiedComplianceCard.tsx`, remover o bloco que exibe o link "X itens afetados" (linhas 230-245). Essa informacao ja esta disponivel na sheet lateral (`ComplianceDetailSheet`).

### Alteracao 2: Passar `categoryColorKey` nos cards do M365
No `M365CategorySection.tsx`, mapear o `colorName` (ex: `blue`) para o formato esperado pelo `CATEGORY_HOVER_CLASSES` (ex: `blue-500`) e passar como prop `categoryColorKey` ao `UnifiedComplianceCard`. Isso fara com que a borda do card e o chevron de "Detalhes" usem a cor da categoria no hover, identico ao Firewall e Domain.

Mapeamento simples: `colorName + '-500'`, com excecoes para `cyan` (`cyan-600`) e `emerald` (`emerald-600`) se necessario. Para os valores atuais do M365 (`blue`, `purple`, `amber`, etc.) todos funcionam com `-500`.

### Arquivos a editar
1. **`src/components/compliance/UnifiedComplianceCard.tsx`** — remover bloco de "itens afetados" (linhas 230-245)
2. **`src/components/m365/posture/M365CategorySection.tsx`** — passar `categoryColorKey={colorName + '-500'}` ao `UnifiedComplianceCard`

