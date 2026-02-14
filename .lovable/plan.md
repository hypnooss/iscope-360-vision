
# Fix: Vulnerabilidades - borda desalinhada pelo recuo

## Problema

O `pl-6` foi aplicado diretamente no `div` que possui a borda (`rounded-lg border border-border/50`), fazendo com que toda a caixa (incluindo a borda) seja empurrada para a direita, mas o conteudo interno nao ganha recuo adicional. Visualmente a borda fica "atras" do titulo.

## Solucao

Envolver o container com borda em um `div` separado com `pl-6`, e remover o `pl-6` do container da borda.

**Arquivo:** `src/pages/external-domain/AttackSurfaceAnalyzerPage.tsx` (linha 656)

**De:**
```tsx
<div className="pl-6 rounded-lg border border-border/50 overflow-hidden">
```

**Para:**
```tsx
<div className="pl-6">
  <div className="rounded-lg border border-border/50 overflow-hidden">
```

E fechar o `div` extra apos o fechamento do container da borda (apos linha 676).
