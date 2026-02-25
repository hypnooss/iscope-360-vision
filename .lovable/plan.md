

# Melhorias na aba Firewalls: botao Atualizar EOL + coluna Servicos mais limpa

## 1. Adicionar botao "Atualizar" para invalidar cache EOL

Adicionar um botao acima da tabela de Firewalls (similar ao "Atualizar Licencas" do M365) que invalida o cache do react-query para `fortinet-eol`, forcando nova consulta ao RSS da Fortinet.

- Usar `useQueryClient().invalidateQueries({ queryKey: ['fortinet-eol'] })`
- Botao com icone `RefreshCw` e texto "Atualizar Ciclo de Vida"
- Mostrar spinner enquanto `isLoading` ou `isFetching`

## 2. Reduzir poluicao visual na coluna "Servicos FortiGuard"

Atualmente a coluna lista todos os nomes dos servicos por extenso (ex: "IPS, App Control, antispam, Antivirus, device os id, Botnet Domain, web filtering, malicious urls, Mobile Malware, Cloud Sandbox, outbreak prevention, ai malware detection, blacklisted certificates"). Isso ocupa muito espaco.

Solucao: mostrar apenas o badge de data + quantidade de servicos, com tooltip mostrando os nomes completos ao passar o mouse.

Exemplo visual:
- `28/07/2026 (154d)  13 servicos` (com tooltip listando todos)
- `14/02/2026 (expirado)  1 servico` (com tooltip)

## Detalhamento tecnico

### Arquivo a modificar

| Arquivo | Alteracao |
|---|---|
| `src/pages/LicensingHubPage.tsx` | Adicionar botao refresh EOL, compactar coluna servicos com contagem + tooltip |

### Alteracoes especificas

**Botao Atualizar (linhas 356-411)**: Adicionar `div` com botao antes da tabela, importar `useQueryClient` do react-query.

**Coluna Servicos (linhas 388-401)**: Substituir listagem de nomes por:
```
<ExpiryBadge ... />
<Tooltip>
  <TooltipTrigger>
    <span>{count} servico(s)</span>
  </TooltipTrigger>
  <TooltipContent>
    <p>{nomes dos servicos}</p>
  </TooltipContent>
</Tooltip>
```

Isso reduz drasticamente a altura de cada linha mantendo toda a informacao acessivel via hover.

