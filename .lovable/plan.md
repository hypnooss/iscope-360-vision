

# Fix: Dialog de Instruções do Super Agent mostrando URL errada

## Problema

Ao visualizar as instruções de instalação de um Super Agent já criado (clicando no botão de instruções na tabela), o componente `AgentInstallInstructions` é renderizado **sem a prop `isSuperAgent`**, fazendo com que exiba o curl do `agent-install` (agent regular) em vez do `super-agent-install`.

## Causa

Na `SuperAgentsPage.tsx`, existem dois usos do componente:
- **Linha 329** (criacao de novo agent): `isSuperAgent` esta presente -- correto
- **Linha 542** (dialog de instrucoes de agent existente): `isSuperAgent` esta **ausente** -- bug

## Correcao

Arquivo: `src/pages/admin/SuperAgentsPage.tsx`

Alterar a linha 542 de:
```tsx
<AgentInstallInstructions activationCode={instructionsAgent.activation_code} />
```
Para:
```tsx
<AgentInstallInstructions activationCode={instructionsAgent.activation_code} isSuperAgent />
```

Isso garante que ambos os contextos (criacao e visualizacao) usem a URL correta do Super Agent.
