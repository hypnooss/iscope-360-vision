

# Fix: Parsing de Arquivos Parece Travado

## Problema

Com 17 arquivos JSON grandes (Swagger/OpenAPI), todos os `FileReader.readAsText` disparam quase simultaneamente e o `JSON.parse` de cada arquivo bloqueia a thread principal do navegador. O resultado e que:

1. A UI congela durante o parsing
2. Nao ha feedback individual por arquivo (so "Processando arquivos..." generico)
3. O usuario pensa que o processo travou

## Solucao

Duas mudancas no arquivo `src/components/admin/ApiDocsManagement.tsx`:

### 1. Mostrar progresso individual durante o parsing

Trocar o texto generico "Processando arquivos..." por um contador que atualiza a cada arquivo processado: **"Processando 5 de 17 arquivos..."**

Adicionar um novo estado `parseProgress` para rastrear quantos arquivos ja foram lidos/parseados.

### 2. Processar arquivos sequencialmente com yield para a UI

Em vez de disparar todos os FileReaders simultaneamente, processar um por vez usando `async/await` com um pequeno `setTimeout(0)` entre cada arquivo. Isso permite que o React re-renderize o contador de progresso entre cada parse.

### Alteracao tecnica

**Arquivo:** `src/components/admin/ApiDocsManagement.tsx`

1. Adicionar estado `parseProgress: number` (0 a N)
2. Reescrever `handleFilesChange` como funcao `async` que:
   - Itera pelos arquivos sequencialmente
   - Le cada arquivo com uma Promise wrapper ao redor do FileReader
   - Faz `JSON.parse` e atualiza `parseProgress` a cada iteracao
   - Usa `await new Promise(r => setTimeout(r, 0))` para dar yield a UI entre arquivos
3. Atualizar o texto de parsing para mostrar: "Processando {parseProgress} de {total} arquivos..."
4. Ao terminar, chama `setParsedFiles` e `setParsing(false)` como antes

Isso garante que o usuario veja o progresso arquivo por arquivo e a UI nao congele.

