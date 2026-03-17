

## Alinhar timeline com a linha verde (coluna de dados)

### Problema
O conteúdo da timeline (botões de período e dots) começa na borda esquerda do `colSpan=10`, ficando desalinhado com as colunas de dados da tabela. A linha verde no print mostra onde deveria começar o alinhamento.

### Mudança

No componente `ScheduleTimeline`, adicionar um `padding-left` maior para que o conteúdo comece alinhado com a terceira coluna (onde ficam os dados), pulando a coluna do chevron e do tipo de ativo:

- Mudar `px-6` para `pl-16 pr-6` no container principal (`div className="px-6 py-6 bg-muted/20"`)
- Isso desloca o conteúdo ~4rem para a direita, alinhando com as colunas de dados após o chevron e o badge de tipo

Alternativa mais precisa: usar `ml-[52px]` (largura do chevron ~40px + padding) para alinhar exatamente com a coluna "Nome do Ativo".

