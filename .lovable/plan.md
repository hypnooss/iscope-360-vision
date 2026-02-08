
# Plano: Remover "Verificar Exchange" e Renomear "Reconsentir"

## Alterações

**Arquivo**: `src/components/m365/TenantStatusCard.tsx`

### 1. Renomear botão "Reconsentir" para "Revalidar Permissões"

Linha 450 - alterar o texto do botão:

```typescript
// Antes
Reconsentir

// Depois
Revalidar Permissões
```

### 2. Remover botão "Verificar Exchange"

Remover as linhas 454-465 (todo o bloco do botão e sua condição):

```typescript
{/* Exchange CBA Verification Button */}
{(tenant.connection_status === 'connected' || tenant.connection_status === 'partial') && (
  <Button 
    variant="outline" 
    size="sm"
    onClick={() => setShowExchangeRbacDialog(true)}
    className="text-blue-600 hover:text-blue-700 hover:bg-blue-500/10 border-border"
  >
    <Settings2 className="w-3 h-3 mr-1" />
    Verificar Exchange
  </Button>
)}
```

### 3. Limpeza de código (opcional mas recomendado)

- Remover import não utilizado `Settings2` (linha 24)
- Remover estado `showExchangeRbacDialog` se não for mais usado (linha 123)
- Remover import do componente `ExchangeRbacSetupDialog` (linha 43)
- Remover renderização do dialog no final do componente

## Resumo

| Alteração | Localização |
|-----------|-------------|
| Renomear "Reconsentir" → "Revalidar Permissões" | Linha 450 |
| Remover botão "Verificar Exchange" | Linhas 454-465 |
| Remover imports e estado não utilizados | Linhas 24, 43, 123 |
| Remover dialog do Exchange RBAC | Final do arquivo |
