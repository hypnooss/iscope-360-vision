
# Corrigir espacamento da pagina CVEs

## Problema
A pagina de CVEs nao possui padding interno, fazendo com que o conteudo fique colado na borda do menu lateral. A pagina Exchange Online utiliza `p-6 lg:p-8` como wrapper, que e o padrao do projeto.

## Solucao
Adicionar a classe `p-6 lg:p-8` ao wrapper principal da pagina CVEs em `M365CVEsPage.tsx`.

## Alteracao

**Arquivo:** `src/pages/m365/M365CVEsPage.tsx` (linha 142)

De:
```
<div className="space-y-6 animate-fade-in">
```

Para:
```
<div className="p-6 lg:p-8 space-y-6 animate-fade-in">
```

Apenas uma linha modificada. O resultado sera visualmente identico ao espacamento da pagina Exchange Online.
