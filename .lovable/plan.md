

# Renomear para "Gestao de Ativos" e adicionar informacoes de End-of-Life dos Firewalls

## 1. Renomear "HUB de Licenciamento" para "Gestao de Ativos"

Alterar o titulo e label em todos os locais:

| Arquivo | Local | De | Para |
|---|---|---|---|
| `src/pages/LicensingHubPage.tsx` | Titulo h1 (linha 180) | "HUB de Licenciamento" | "Gestao de Ativos" |
| `src/pages/LicensingHubPage.tsx` | Subtitulo (linha 181) | "Controle centralizado de licencas e certificados" | "Controle centralizado de ativos, licencas e certificados" |
| `src/components/layout/AppLayout.tsx` | Sidebar label (linha 668) | "HUB de Licenciamento" | "Gestao de Ativos" |
| `src/components/layout/AppLayout.tsx` | Comentario (linha 663) | "HUB de Licenciamento" | "Gestao de Ativos" |

---

## 2. Incluir Modelo do Fortigate na tabela de Firewalls

Atualmente o hook `useLicensingHub.ts` busca `firewalls.select('id, name, client_id')`. Sera adicionado o campo `serial_number` ao select, e tambem extrair o `model` do `report_data.systemInfo.model` da ultima analise (ja consultada).

- Adicionar campo `model` ao tipo `FirewallLicense`
- Extrair `report_data.systemInfo?.model` no loop existente
- Exibir coluna "Modelo" na tabela de Firewalls

---

## 3. Validacao End-of-Life via RSS Fortinet

Criar uma Edge Function `fortinet-hardware-eol` que:
1. Faz fetch do XML `https://support.fortinet.com/rss/Hardware.xml`
2. Recebe o modelo do firewall como parametro (ex: "FortiGate-200F")
3. Busca no RSS por entradas que correspondam ao modelo
4. Extrai as datas: End of Order, Last Service Extension, End of Support
5. Retorna os dados ou `null` se nao encontrado

O formato do RSS (cada item) contem no campo description:
```text
Category: FortiGate, <br/>End of Order: 2025-09-18, <br/>Last Service Extension: 2029-09-18, <br/>End of Support: 2030-09-18
```

### Frontend

Na tabela de Firewalls, adicionar uma coluna "Ciclo de Vida" que:
- Ao carregar a pagina, para cada firewall com modelo identificado, chama a Edge Function (com cache via react-query)
- Exibe badges com as datas de End of Order, Last Service Extension, End of Support
- Caso nao haja dados publicados, exibe um badge sutil "Sem dados de EOL"

---

## Detalhamento tecnico

### Arquivos a criar

| Arquivo | Descricao |
|---|---|
| `supabase/functions/fortinet-hardware-eol/index.ts` | Edge Function que busca o RSS e retorna dados de lifecycle para um modelo |

### Arquivos a modificar

| Arquivo | Alteracao |
|---|---|
| `src/hooks/useLicensingHub.ts` | Adicionar `model` ao tipo `FirewallLicense`, extrair de `systemInfo.model` |
| `src/pages/LicensingHubPage.tsx` | Renomear titulo; adicionar coluna Modelo e coluna Ciclo de Vida com chamada a Edge Function |
| `src/components/layout/AppLayout.tsx` | Renomear label no sidebar |
| `supabase/config.toml` | Registrar nova funcao com `verify_jwt = false` |

### Logica de matching do modelo no RSS

O RSS usa nomes como `FortiGate-200F`, `FortiGate-60F`, etc. O modelo vindo do `systemInfo.model` pode estar como `FortiGate 200F` ou `FGT200F`. A Edge Function fara matching flexivel:
- Normalizar removendo hifen e espacos
- Tentar match exato primeiro, depois match parcial
- Filtrar apenas items com `Category: FortiGate` (ignorar acessorios)

### Fluxo de cache

A Edge Function sera chamada com o modelo como parametro. O react-query cacheia o resultado por modelo, evitando chamadas duplicadas para firewalls do mesmo modelo.

