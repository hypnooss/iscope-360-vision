
# Remover o Aviso "Observação sobre portas e SSL"

## Análise do Estado Atual

Após verificar o código em `src/pages/environment/AddFirewallPage.tsx`:

- **Step 1 (Fabricante)**: botão "Voltar" já existe ao lado de "Próximo" (linha 603) — nenhuma mudança necessária.
- **Step 2 (Instruções)**: botão "Voltar" já existe ao lado de "Próximo" (linha 640) — nenhuma mudança necessária.
- **Aviso amber "Observação sobre portas e SSL"**: existe nas linhas 274-279 dentro da função `FortiGateInstructions()` e precisa ser removido.

## Única Mudança Necessária

Remover o bloco `<div>` com o aviso amber em `src/pages/environment/AddFirewallPage.tsx` (linhas 274-279):

```
<div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
  <p className="text-sm text-amber-400 font-medium">⚠️ Observação sobre portas e SSL</p>
  <p className="text-xs text-amber-300/80 mt-1">
    A porta padrão da API HTTPS do FortiGate é 8443...
  </p>
</div>
```

## Resumo

| Item | Ação |
|---|---|
| Botão "Voltar" no Step 1 | Sem alteração — já existe |
| Botão "Voltar" no Step 2 | Sem alteração — já existe |
| Aviso amber SSL/Portas | Remover da função `FortiGateInstructions` |
