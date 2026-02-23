

# Progress/Status Indicators para Upload em Lote

## Problema

Ao selecionar varios JSONs, nao ha feedback visual durante o parsing dos arquivos nem durante o envio ao banco. O usuario nao sabe se esta funcionando.

## Solucao

Adicionar indicadores de progresso em duas etapas:

### 1. Parsing dos arquivos (leitura local)

- Novo estado `parsing` (boolean) -- ativado enquanto os FileReaders estao processando
- Exibir "Processando X arquivos..." com spinner abaixo do input de arquivo

### 2. Upload para o banco (envio em lote)

- Novo estado `uploadProgress` (numero do arquivo atual sendo enviado)
- Durante o upload, mostrar uma barra de progresso (Progress component) com texto "Enviando 3 de 8..."
- Cada item na lista de preview recebe um indicador visual: check verde (enviado), spinner (enviando), cinza (pendente)
- Desabilitar botoes e inputs durante o upload

### Alteracoes tecnicas

**Arquivo:** `src/components/admin/ApiDocsManagement.tsx`

- Adicionar estados: `parsing: boolean`, `uploadProgress: number` (0 = nao iniciado, 1..N = arquivo atual)
- Em `handleFilesChange`: setar `parsing = true` no inicio, `false` ao terminar todos os FileReaders
- Em `handleSubmitBatch`: atualizar `uploadProgress` a cada iteracao do loop
- Na lista de preview (linhas 389-409): adicionar icone condicional por arquivo (CheckCircle2, Loader2, ou FileText)
- Acima da lista durante upload: barra de Progress mostrando `(uploadProgress / parsedFiles.length) * 100`
- No botao Enviar: trocar texto para "Enviando X de Y..." durante upload
- Importar `Progress` de `@/components/ui/progress` e `CheckCircle2` de `lucide-react`
