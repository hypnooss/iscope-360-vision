

# Fix: "Processando arquivos..." Fica Travado

## Problema

O indicador "Processando arquivos..." nunca desaparece porque o `FileReader` nao tem handler de erro (`onerror`). Se qualquer arquivo falha na leitura, o contador `processed` nunca alcanca `files.length`, e `setParsing(false)` nunca e chamado.

## Solucao

**Arquivo:** `src/components/admin/ApiDocsManagement.tsx`

1. Adicionar `reader.onerror` para cada arquivo, incrementando `processed` e exibindo toast de erro
2. Mover a checagem `if (processed === files.length)` para uma funcao compartilhada entre `onload` e `onerror`
3. Garantir que `setParsing(false)` e chamado mesmo se todos os arquivos falharem

### Alteracao tecnica

Na funcao `handleFilesChange` (linha ~145-164), adicionar apos `reader.onload`:

```typescript
reader.onerror = () => {
  processed++;
  toast.error(`Erro ao ler: ${file.name}`);
  if (processed === files.length) {
    setParsedFiles((prev) => [...prev, ...newParsed]);
    setParsing(false);
  }
};
```

Isso resolve o travamento com uma unica alteracao de ~6 linhas.
