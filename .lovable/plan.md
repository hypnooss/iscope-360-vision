

# Upload em Lote de Documentacao API com Seletor de Versao FortiOS

## Problema

Atualmente o upload e feito arquivo por arquivo, e a versao precisa ser digitada manualmente. Como os JSONs exportados do FortiOS nao incluem a versao do sistema operacional, e necessario selecionar a versao antes de fazer o upload em lote.

## Solucao

Alterar o dialog de upload em `ApiDocsManagement.tsx` para suportar **multiplos arquivos** com um **seletor de versao FortiOS** obrigatorio no topo.

### Fluxo do Usuario

1. Clicar em "Adicionar Documento"
2. Selecionar a **versao do FortiOS** (ex: 7.4, 7.2, 7.0, 6.4) -- campo obrigatorio no topo do dialog
3. Opcionalmente informar a versao especifica (ex: 7.4.11) ou deixar apenas a major (7.4)
4. Selecionar **multiplos arquivos JSON** de uma vez (input com `multiple`)
5. O sistema detecta automaticamente o **tipo** (log_api, monitor_api, rest_api) pelo conteudo/titulo do JSON
6. Lista preview dos arquivos selecionados com titulo, tipo detectado e contagem de endpoints
7. Clicar em "Enviar Todos" para fazer o upload em lote
8. Observacoes opcionais aplicadas a todos os documentos do lote

### Alteracoes no Componente

**Arquivo:** `src/components/admin/ApiDocsManagement.tsx`

1. **Seletor de versao FortiOS** -- Select com versoes pre-definidas (7.4, 7.2, 7.0, 6.4) + opcao "Outra" para digitar manualmente
2. **Input de arquivo com `multiple`** -- Permite selecionar varios JSONs de uma vez
3. **Estado de arquivos como array** -- Substituir `jsonContent`/`fileName` por um array de objetos `{ file, name, content, detectedType, detectedTitle, endpointCount }`
4. **Auto-deteccao de tipo** -- Analisar o titulo/basePath/paths do JSON para inferir se e `log_api`, `monitor_api` ou `rest_api`
5. **Lista de preview** -- Mostrar todos os arquivos selecionados com tipo detectado e permitir remover individualmente
6. **Submit em lote** -- Inserir todos os documentos com a mesma versao selecionada

### Deteccao Automatica de Tipo

Logica para inferir `doc_type` a partir do conteudo JSON:

```text
Se basePath contem "/log/" ou titulo contem "Log" -> log_api
Se basePath contem "/monitor/" ou titulo contem "Monitor" -> monitor_api
Se basePath contem "/cmdb/" ou titulo contem "CMDB" ou "REST" -> rest_api
Senao -> reference
```

### Versoes Pre-definidas

```text
FORTIOS_VERSIONS = [
  { value: '7.6', label: 'FortiOS 7.6' },
  { value: '7.4', label: 'FortiOS 7.4' },
  { value: '7.2', label: 'FortiOS 7.2' },
  { value: '7.0', label: 'FortiOS 7.0' },
  { value: '6.4', label: 'FortiOS 6.4' },
]
```

Com campo de versao especifica opcional (ex: digitar "7.4.11" manualmente).

### Detalhes Tecnicos

- Nenhuma alteracao no banco de dados -- a tabela `device_type_api_docs` ja suporta tudo
- Cada arquivo gera um registro separado na tabela, todos com a mesma `version`
- O titulo e extraido automaticamente do `info.title` do JSON quando disponivel
- O tipo e detectado automaticamente mas pode ser ajustado manualmente na lista de preview
- Inserir todos os registros em sequencia (nao em paralelo) para evitar problemas com rate limiting do Supabase

### Resumo

| Arquivo | Acao |
|---|---|
| `src/components/admin/ApiDocsManagement.tsx` | Refatorar dialog de upload para suportar multiplos arquivos + seletor de versao |

