# Tela de selecao de alvos antes do Disparar Scan

## Resumo

Ao clicar em "Disparar Scan", em vez de disparar imediatamente, abrira um Dialog mostrando todos os alvos (IPs de DNS e interfaces WAN de firewall) para o usuario selecionar quais incluir no snapshot. Todos vem selecionados por padrao, com botoes "Selecionar Todos" e "Deselecionar Todos". Inserir um aviso no topo desse Dialog "Essas informações foram coletadas de forma automática, convém revisar manualmente, visto que o processo de Surface Analyzer é um processo lento e caro."

## Fluxo do usuario

1. Usuario clica "Disparar Scan"
2. O sistema busca os alvos disponiveis (chamando uma nova edge function ou reutilizando logica existente)
3. Abre um Dialog com duas secoes: **DNS** e **Firewall**
4. Cada alvo tem um checkbox; todos iniciam selecionados
5. Interfaces WAN do firewall aparecem com a subnet sumarizada (ex: `177.120.53.8/27`)
6. Botoes "Selecionar Todos" / "Deselecionar Todos" no topo
7. Botao "Iniciar Scan" envia apenas os alvos selecionados

## Detalhes tecnicos

### 1. Nova Edge Function: `attack-surface-preview`

Extrai a mesma logica de coleta de IPs que ja existe em `run-attack-surface-queue` (funcoes `extractDomainIPs` e `extractFirewallIPs`), mas **retorna os alvos sem criar snapshot/tasks**. 

Para interfaces de firewall, alem dos IPs expandidos, retornara o campo `subnet` original (ex: `177.120.53.8 255.255.255.240`) para exibicao como CIDR (`/27`).

Resposta:

```json
{
  "dns": [
    { "ip": "200.1.2.3", "label": "www.example.com" }
  ],
  "firewall": [
    { "ip": "177.120.53.8", "label": "FW-Prod - wan1", "subnet": "177.120.53.8/27", "expanded_ips": ["177.120.53.9", "..."] }
  ]
}
```

### 2. Modificar `run-attack-surface-queue`

Aceitar um campo opcional `selected_ips` no body. Se presente, usar apenas esses IPs em vez de coletar automaticamente. Formato:

```json
{ "client_id": "...", "selected_ips": [{ "ip": "...", "source": "dns", "label": "..." }] }
```

### 3. Novo componente: `AttackSurfaceScanDialog`

- Dialog com titulo "Selecionar Alvos do Scan"
- Ao abrir, chama `attack-surface-preview` para buscar alvos
- Estado de loading enquanto busca
- Duas secoes com icones (Globe para DNS, Server para Firewall)
- Firewall mostra a subnet CIDR sumarizada ao lado do nome
- Checkboxes individuais + botoes bulk no header
- Contador de selecionados (ex: "12 de 15 alvos selecionados")
- Botao "Iniciar Scan" desabilitado se nenhum alvo selecionado

### 4. Atualizar `useAttackSurfaceData.ts`

- `useAttackSurfaceScan` passa a aceitar `selected_ips` opcional no mutationFn
- Nova funcao/hook `useAttackSurfacePreview` para chamar a edge function de preview

### 5. Atualizar `AttackSurfaceAnalyzerPage.tsx`

- Substituir o `onClick` direto do botao "Disparar Scan" por abertura do dialog
- Importar e renderizar o novo `AttackSurfaceScanDialog`

### Arquivos a criar/modificar


| Arquivo                                                      | Acao                                                         |
| ------------------------------------------------------------ | ------------------------------------------------------------ |
| `supabase/functions/attack-surface-preview/index.ts`         | Criar - edge function que retorna alvos sem executar scan    |
| `supabase/functions/run-attack-surface-queue/index.ts`       | Modificar - aceitar `selected_ips` opcional                  |
| `src/components/external-domain/AttackSurfaceScanDialog.tsx` | Criar - dialog de selecao de alvos                           |
| `src/hooks/useAttackSurfaceData.ts`                          | Modificar - adicionar preview hook e atualizar scan mutation |
| `src/pages/external-domain/AttackSurfaceAnalyzerPage.tsx`    | Modificar - integrar dialog no botao                         |
