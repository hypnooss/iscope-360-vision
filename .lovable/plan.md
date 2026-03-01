

## Transformar "Executar Análise" em Dropdown "Executar Ações" nas telas de Compliance

### Escopo

Duas telas de Compliance possuem o botao "Executar Analise":

1. `src/pages/firewall/FirewallCompliancePage.tsx` (linha 343-347)
2. `src/pages/external-domain/ExternalDomainCompliancePage.tsx` (linha 546-550)

### Mudancas por arquivo

**Ambos os arquivos - mesma logica:**

- Substituir o `<Button>` atual por um `<DropdownMenu>` com trigger estilizado
- O trigger sera: `Executar Ações` + divisor vertical (`|`) + icone `ChevronDown`
- O trigger NAO executa nenhuma acao alem de abrir o menu
- 4 itens no dropdown:
  - **Gerar Análise** (icone `Play`) - chama a funcao `handleRefresh` existente
  - **Exportar PDF** (icone `FileDown`) - placeholder/toast por enquanto (ExternalDomain ja tem PDF, Firewall nao tem nessa tela)
  - **Exportar CVE** (icone `FileText`) - placeholder/toast
  - **Criar GMUD** (icone `ClipboardList`) - placeholder/toast
- Importar `DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger` e icones adicionais (`ChevronDown, FileDown, ClipboardList`)
- O item "Gerar Análise" fica desabilitado durante `isRefreshing` e mostra spinner
- O trigger inteiro fica desabilitado se nao houver firewall/dominio selecionado

### Estrutura visual do botao

```text
[ Executar Ações  |  ▾ ]
```

Ao clicar:
```text
  ▸ Gerar Análise
  ▸ Exportar PDF
  ▸ Exportar CVE
  ▸ Criar GMUD
```

