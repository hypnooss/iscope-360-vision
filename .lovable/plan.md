
# Ajuste na coluna "Domínio" e badge "Tipo" para execuções Surface Scanner

## O que precisa mudar

Na tabela de execuções (linhas 654–697 do arquivo `ExternalDomainExecutionsPage.tsx`), as linhas do tipo `attack_surface` atualmente exibem:

- **Domínio**: `"Attack Surface Scan"` (retornado pela função `getDomainLabel('')`)
- **Agent**: `-` (já correto)
- **Tipo**: badge com label `"Attack Surface"` (precisa ser `"Surface Scanner"`)

## Mudanças

### 1. Coluna Domínio — exibir traço `-` para attack_surface

**Linha 655–657** — trocar `getDomainLabel(item.domainId)` por lógica condicional:

```tsx
// Antes
<TableCell className="font-medium">
  {getDomainLabel(item.domainId)}
</TableCell>

// Depois
<TableCell className="font-medium">
  {item.type === 'attack_surface' ? '-' : getDomainLabel(item.domainId)}
</TableCell>
```

### 2. Badge Tipo — label `"Surface Scanner"` em vez de `"Attack Surface"`

**Linha 133** — atualizar o `typeConfig`:

```tsx
// Antes
attack_surface: {
  label: 'Attack Surface',
  ...
}

// Depois
attack_surface: {
  label: 'Surface Scanner',
  ...
}
```

## Arquivos modificados

- **`src/pages/external-domain/ExternalDomainExecutionsPage.tsx`**: dois ajustes pontuais — label do tipo e lógica do domínio para linhas `attack_surface`.
