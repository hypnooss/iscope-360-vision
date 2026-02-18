
# Ajustes no Wizard de Adição de Firewall — Header e Botão Voltar

## O que o usuário pediu

1. **Remover o bloco de título** ("Adicionar Firewall" + subtítulo "Configure um novo dispositivo de segurança") que aparece entre a breadcrumb e o step indicator.
2. **Manter o espaçamento** entre a breadcrumb e o step indicator (sem colapsar o espaço).
3. **Adicionar um botão "Voltar"** na área de ações do rodapé, à esquerda do botão "Próximo" — em todos os steps, não apenas o step 1.

## Mudanças no arquivo `src/pages/environment/AddFirewallPage.tsx`

### 1. Remover o bloco de header (linhas 455–464)

```tsx
// REMOVER todo este bloco:
{/* Header */}
<div className="flex items-center gap-4">
  <Button variant="ghost" size="icon" onClick={handleBack}>
    <ArrowLeft className="h-5 w-5" />
  </Button>
  <div>
    <h1 className="text-2xl font-bold">Adicionar Firewall</h1>
    <p className="text-sm text-muted-foreground">Configure um novo dispositivo de segurança</p>
  </div>
</div>
```

### 2. Ajustar espaçamento

O `space-y-6` do container já cuida do espaçamento entre a breadcrumb e o `StepIndicator`. Com a remoção do header, o espaço natural de `space-y-6` entre os dois elementos será mantido — sem necessidade de ajuste adicional.

### 3. Adicionar botão "Voltar" nos rodapés de cada step

**Step 1** — rodapé atual só tem "Próximo", mudar para:
```tsx
<div className="flex justify-between">
  <Button variant="outline" onClick={handleBack}>
    <ArrowLeft className="w-4 h-4" />
    Voltar
  </Button>
  <Button onClick={handleNext} disabled={!canAdvanceStep1}>
    Próximo
    <ArrowRight className="w-4 h-4" />
  </Button>
</div>
```

**Steps 2, 3 e 4** — já possuem `flex justify-between` com botão Voltar e Próximo/Adicionar, portanto não precisam de alteração de layout — apenas verificar que o botão Voltar está presente.

## Arquivos modificados

- **`src/pages/environment/AddFirewallPage.tsx`**: remoção do bloco de header (h1 + p + botão ArrowLeft inline) e adição de botão "Voltar" no rodapé do step 1.
