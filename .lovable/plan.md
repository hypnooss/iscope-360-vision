

# Melhorar visual do painel expandido do IP

## Problema

O conteudo expandido (OS, Hostnames, Web Services, CVEs) aparece "solto" dentro da tabela, sem hierarquia visual clara que associe essas informacoes ao IP da linha. Falta recuo e diferenciacao de fundo.

## Solucao

Aplicar as seguintes melhorias visuais ao container do painel expandido:

### 1. Recuo a esquerda com borda indicativa

Adicionar um `ml-6` (margem esquerda) ao container principal e uma borda esquerda colorida (`border-l-2 border-primary/50`) que funcione como indicador visual de subordinacao ao IP.

### 2. Background diferenciado

Trocar o `bg-muted/30` atual por um fundo mais escuro e distinto, como `bg-background/80`, criando contraste com a linha da tabela.

### 3. Container com card visual

Envolver todo o conteudo expandido em um card com `rounded-lg` e padding interno, dando a impressao de que e um bloco de detalhes pertencente ao IP.

## Detalhes tecnicos

### Arquivo: `src/pages/external-domain/AttackSurfaceAnalyzerPage.tsx`

**Linha 831** - Alterar o container `div` do painel expandido:

De:
```
<div className="bg-muted/30 border-t border-border/50 p-4 space-y-4">
```

Para:
```
<div className="mx-4 my-3 rounded-lg border border-border/50 bg-card/60 p-4 space-y-4 border-l-2 border-l-primary/40">
```

Isso aplica:
- `mx-4 my-3`: margem horizontal e vertical para separar do container da tabela
- `rounded-lg`: bordas arredondadas para parecer um card
- `bg-card/60`: fundo do card com leve transparencia, diferenciando do fundo da tabela
- `border-l-2 border-l-primary/40`: borda esquerda colorida (teal) como indicador visual de que o conteudo pertence ao IP
- Remove `border-t` pois o card ja tera sua propria borda

