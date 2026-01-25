
# Correção do Dialog de Detalhes da Tarefa

## Problema Identificado

O dialog de detalhes em `TaskExecutionsPage.tsx` (linhas 452-573) tem uma `ScrollArea` envolvendo **todo o conteúdo** do dialog, quando o scroll deveria existir **apenas na caixa de Resultado (JSON)**.

## Estrutura Atual (Problemática)

```text
DialogContent
└── ScrollArea (max-h-[60vh]) ← Scroll afeta TUDO
    └── div.space-y-6
        ├── Info Grid
        ├── Timestamps
        ├── Error Message
        ├── Step Results
        └── Resultado (JSON) ← Não consegue rolar independentemente
```

## Estrutura Proposta

```text
DialogContent (flex flex-col, max-h-[85vh])
├── DialogHeader (flex-shrink-0)
└── div.flex-1.overflow-auto ← Scroll natural do conteúdo principal
    ├── Info Grid
    ├── Timestamps
    ├── Error Message
    ├── Step Results
    └── Resultado (JSON)
        └── ScrollArea (h-[200px]) ← Scroll APENAS aqui
```

## Alterações Necessárias

### Arquivo: `src/pages/firewall/TaskExecutionsPage.tsx`

**1. Alterar DialogContent (linha 454)**

De:
```tsx
<DialogContent className="max-w-2xl max-h-[80vh]">
```

Para:
```tsx
<DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
```

**2. Adicionar flex-shrink-0 ao DialogHeader (linha 455)**

De:
```tsx
<DialogHeader>
```

Para:
```tsx
<DialogHeader className="flex-shrink-0">
```

**3. Remover ScrollArea e usar overflow nativo (linhas 459-570)**

De:
```tsx
<ScrollArea className="max-h-[60vh]">
  <div className="space-y-6 pr-4">
    ...
  </div>
</ScrollArea>
```

Para:
```tsx
<div className="flex-1 overflow-y-auto space-y-6 pr-4">
  ...
</div>
```

**4. Adicionar ScrollArea apenas no Resultado JSON (linhas 561-567)**

De:
```tsx
{selectedTask.result && (
  <div>
    <p className="text-sm text-muted-foreground mb-2">Resultado (JSON)</p>
    <pre className="bg-muted/50 border rounded-lg p-3 text-xs overflow-x-auto max-h-[200px]">
      {JSON.stringify(selectedTask.result, null, 2)}
    </pre>
  </div>
)}
```

Para:
```tsx
{selectedTask.result && (
  <div>
    <p className="text-sm text-muted-foreground mb-2">Resultado (JSON)</p>
    <div className="bg-muted/50 border rounded-lg p-3">
      <ScrollArea className="h-[200px]">
        <pre className="text-xs font-mono whitespace-pre-wrap break-all">
          {JSON.stringify(selectedTask.result, null, 2)}
        </pre>
      </ScrollArea>
    </div>
  </div>
)}
```

## Resultado Esperado

| Antes | Depois |
|-------|--------|
| Scroll afeta o dialog inteiro | Conteúdo principal ocupa espaço natural |
| Não é possível ver o JSON completo | JSON tem scroll próprio com altura fixa |
| Barra de rolagem no lugar errado | Barra de rolagem apenas no JSON |

## Impacto

- Melhora a UX permitindo visualizar todos os metadados sem scroll
- JSON de resultado agora é navegável independentemente
- Segue o padrão de dialogs definido no projeto (altura máxima com scroll interno)
