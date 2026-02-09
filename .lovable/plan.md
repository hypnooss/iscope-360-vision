

# Alterar Cor da Tag API (Cloud)

## Problema

A tag "API" usa azul (`blue-500`), mesma cor da tag de status "Executando", causando confusao visual.

Cores ja em uso nas tags de status:
- Vermelho: Falha
- Verde: Concluido
- Azul: Executando
- Roxo: Agent (tipo)

## Solucao

Trocar a cor da tag "API" de azul para **teal/cyan** (`teal-400`), que e a cor primaria do design system e nao conflita com nenhuma tag de status existente.

## Mudanca

**Arquivo:** `src/pages/external-domain/ExternalDomainExecutionsPage.tsx` (linha 115)

De:
```
bg-blue-500/20 text-blue-500 border-blue-500/30
```

Para:
```
bg-teal-400/20 text-teal-400 border-teal-400/30
```

