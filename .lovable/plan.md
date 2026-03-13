

## Exportar MFA para Excel — Botão na barra de abas

### Mudanças

**1. Instalar `xlsx` (SheetJS)** — biblioteca leve para gerar arquivos Excel no browser, sem dependência de backend.

**2. `EntraIdCategorySheet.tsx` — caso `mfa_coverage`**

- Importar `utils/write-xlsx` do SheetJS e o ícone `Download` do lucide-react.
- Adicionar um botão de exportação ao final da `TabsList` (após a última aba), alinhado à direita com `ml-auto`.
- Ao clicar, gerar um Excel com **todos** os usuários do `mfa.userDetails` (sem limite de 10), contendo as colunas:
  - **Nome** (`displayName`)
  - **UPN** (`upn`)
  - **Classificação** ("MFA Forte", "MFA Fraco", "Sem MFA")
  - **Métodos** (lista separada por vírgula, com labels legíveis)
  - **Método Padrão** (`defaultMethod`, com label legível)
- O arquivo será nomeado `cobertura-mfa-{data}.xlsx`.

**3. Lógica de classificação no export** — reutiliza a mesma lógica de `WEAK_METHODS` já presente no componente para categorizar cada usuário.

### Detalhes técnicos

- Usarei `xlsx` (SheetJS Community Edition) que roda 100% no browser.
- A função de export criará um `Workbook` com uma sheet "Cobertura MFA", aplicará larguras de coluna automáticas e disparará o download via `writeFile`.
- O botão será um `<Button variant="ghost" size="sm">` com ícone de download, posicionado no fim da TabsList.

