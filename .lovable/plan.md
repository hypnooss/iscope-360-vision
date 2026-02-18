
# Ocultar completamente o campo Workspace para não-super usuários

## Problema

No arquivo `AddExternalDomainPage.tsx`, a lógica atual tem:

```tsx
{isSuperUser ? (
  <div> {/* Select de Workspace */} </div>
) : (
  <div>
    <Label>Workspace</Label>
    <Input value={clients.length === 1 ? clients[0].name : 'Carregando...'} disabled />
  </div>
)}
```

Mesmo quando `isSuperUser` é `false` (como quando se está em preview mode de um admin), o campo **continua sendo renderizado** com label "Workspace" e o texto "Carregando...". Isso porque o `client_id` é auto-preenchido via `useEffect`, mas o campo visível nunca some.

## Solução

Remover o bloco `else` inteiro (linhas 284-289). Para usuários não-super, o Workspace é auto-preenchido silenciosamente via `useEffect` — não precisa de nenhum campo visual.

O grid de 2 colunas que envolve o campo Workspace e o campo Domínio também precisa ser ajustado: quando `isSuperUser` é `false`, o campo Domínio deve ocupar a linha inteira (sem a coluna do Workspace ao lado).

## Detalhes técnicos

### Arquivo modificado

**`src/pages/AddExternalDomainPage.tsx`** — linhas 265-306:

**Antes:**
```tsx
<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
  {isSuperUser ? (
    <div className="space-y-2">
      <Label>Workspace *</Label>
      <Select ...>...</Select>
    </div>
  ) : (
    <div className="space-y-2">
      <Label>Workspace</Label>
      <Input value={clients.length === 1 ? clients[0].name : 'Carregando...'} disabled />
    </div>
  )}
  <div className="space-y-2">
    <Label>Domínio Externo *</Label>
    <Input ... />
  </div>
</div>
```

**Depois:**
```tsx
<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
  {isSuperUser && (
    <div className="space-y-2">
      <Label>Workspace *</Label>
      <Select ...>...</Select>
    </div>
  )}
  <div className="space-y-2">
    <Label>Domínio Externo *</Label>
    <Input ... />
  </div>
</div>
```

Trocar o ternário por um `&&` simples, eliminando completamente o bloco `else` com o Input de "Carregando...".
