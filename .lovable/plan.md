

# Reformular Inventario de IPs Publicos

## Mudancas

### 1. Remover aninhamento extra do IP Inventory
Atualmente o IP Inventory tem um `Card > CardContent > div.rounded-lg.border > Table`. O TLS Certificates usa a mesma estrutura (`Card > CardContent > div > Table`), mas visualmente parecem diferentes porque o IP Inventory tem bordas extras. Vou alinhar o estilo removendo o `div.rounded-lg.border.overflow-hidden` wrapper interno, deixando a Table diretamente dentro do CardContent, identico ao TLS.

### 2. Coluna Portas: badges individuais
Em vez de exibir o numero "5", exibir badges com cada porta encontrada:
```
[22] [80] [443] [853] [40443]
```
Usando `Badge variant="outline"` com estilo `font-mono text-[10px]` em um `flex flex-wrap gap-1`.

### 3. Coluna Servicos: badges individuais  
Em vez de exibir o numero "3", exibir badges com o nome de cada servico (product do nmap):
```
[OpenSSH] [nginx] [AdGuard]
```
Servicos sem nome de produto serao omitidos. Se nenhum servico tiver nome, exibe "—".

## Detalhes tecnicos

### Arquivo: `src/pages/external-domain/AttackSurfaceAnalyzerPage.tsx`

**IPDetailRow (linhas 514-533)** — Alterar as celulas de Portas e Servicos:
- Portas: `result?.ports?.map()` renderizando badges individuais
- Servicos: `result?.services?.filter(s => s.product).map()` + `result?.web_services?.map()` renderizando badges com nome

**IP Inventory section (linhas 765-784)** — Remover o `div.rounded-lg.border.overflow-hidden` wrapper, colocando a Table diretamente no CardContent, igualando ao layout do TLS Certificates.

