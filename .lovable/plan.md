

## Fix: Subdomínios quebrando entre páginas no PDF

### Problema
A seção "Subdomínios" está dentro do `PDFDNSMap`, que é renderizado na Page 3 do PDF. Quando NS, SOA, MX e TXT ocupam espaço suficiente, os subdomínios começam no fim da página e quebram entre páginas.

### Solução
Separar os subdomínios do `PDFDNSMap` e renderizá-los numa `<Page>` dedicada no `ExternalDomainPDF.tsx` — mesma abordagem usada para "Verificações Aprovadas".

### Alterações

**1. `src/components/pdf/sections/PDFDNSMap.tsx`**
- Remover a seção de subdomínios (linhas 426-493) do componente
- Exportar as funções auxiliares `truncate` e os tipos/styles necessários para reuso, ou criar um novo componente `PDFSubdomainSection`

**2. `src/components/pdf/ExternalDomainPDF.tsx`**
- Adicionar uma nova `<Page>` dedicada para subdomínios, após a página do DNS Map
- Renderizar o header "Subdomínios" + cards na nova página com `wrap` habilitado
- A seção só aparece se houver subdomínios ativos

**Abordagem concreta**: Extrair a renderização dos subdomínios para um componente separado (ou inline no ExternalDomainPDF) e colocá-lo numa `<Page>` própria com `wrap`, garantindo que o título sempre fique no topo da página e os cards fluam naturalmente.

