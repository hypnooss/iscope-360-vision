
# Seleção de IP WAN quando há múltiplos IPs Públicos

## Problema Atual

A Edge Function `resolve-firewall-geo` para imediatamente no **primeiro** IP público encontrado (`wanInterfaces[0]`) e o frontend aplica diretamente no formulário, sem dar opção ao usuário quando há mais de um IP WAN público.

## Solução

### 1 — Edge Function `resolve-firewall-geo` (modificar)

**Mudanças na função `getPublicWanIP`:**
- Renomear para `getPublicWanIPs` (plural) — retornar **todos** os pares `{ ip, interfaceName }`

**Mudanças na função `geolocateIP`:**
- Enriquecer o retorno com dados completos da `ipapi.co`: `latitude`, `longitude`, `country_name`, `country_code`, `region`, `city`

**Novo fluxo do handler principal:**
- Geolocalizar **todos** os IPs em paralelo (`Promise.all`)
- Se 1 IP → retornar diretamente (comportamento atual, sem quebra de UX)
- Se 2+ IPs → retornar `{ success: true, multiple: true, candidates: [...] }` com a lista enriquecida

**Novo contrato de resposta (múltiplos IPs):**
```json
{
  "success": true,
  "multiple": true,
  "candidates": [
    {
      "ip": "201.33.x.x",
      "interface": "wan1",
      "lat": -23.5505,
      "lng": -46.6333,
      "country": "Brazil",
      "country_code": "BR",
      "region": "São Paulo",
      "city": "São Paulo"
    },
    {
      "ip": "177.10.x.x",
      "interface": "wan2",
      "lat": -15.7801,
      "lng": -47.9292,
      "country": "Brazil",
      "country_code": "BR",
      "region": "Distrito Federal",
      "city": "Brasília"
    }
  ]
}
```

**Resposta para IP único (sem quebra):**
```json
{
  "success": true,
  "multiple": false,
  "lat": -23.5505,
  "lng": -46.6333,
  "ip": "201.33.x.x",
  "interface": "wan1",
  "country": "Brazil",
  "country_code": "BR",
  "region": "São Paulo",
  "city": "São Paulo"
}
```

---

### 2 — Frontend `src/pages/environment/AddFirewallPage.tsx` (modificar)

#### Novo estado para candidatos
```tsx
const [wanCandidates, setWanCandidates] = useState<WanCandidate[]>([]);
const [showWanDialog, setShowWanDialog] = useState(false);
```

#### Tipo `WanCandidate`
```tsx
interface WanCandidate {
  ip: string;
  interface: string;
  lat: number;
  lng: number;
  country: string;
  country_code: string;
  region: string;
  city: string;
}
```

#### Lógica do botão "Buscar" (atualizada)
```
1. Chama resolve-firewall-geo
2. Se data.multiple === false → aplica diretamente (comportamento atual + exibe país/cidade no toast)
3. Se data.multiple === true → salva candidates no estado e abre WanSelectorDialog
```

#### Novo componente `WanSelectorDialog`
Dialog modal (usando `<Dialog>` do shadcn já disponível) que exibe os candidatos em cards:

```
┌────────────────────────────────────────────┐
│ Múltiplos IPs WAN encontrados              │
│ Selecione o IP que representa a localização│
│ física deste firewall                       │
├────────────────────────────────────────────┤
│ ┌──────────────────────────────────────┐   │
│ │ 🏳️ BR  wan1                          │   │
│ │ IP: 201.33.x.x                       │   │
│ │ São Paulo, SP — Brazil               │   │
│ │ Coords: -23.5505, -46.6333           │   │
│ │                  [Selecionar]        │   │
│ └──────────────────────────────────────┘   │
│ ┌──────────────────────────────────────┐   │
│ │ 🏳️ BR  wan2                          │   │
│ │ IP: 177.10.x.x                       │   │
│ │ Brasília, DF — Brazil                │   │
│ │ Coords: -15.7801, -47.9292           │   │
│ │                  [Selecionar]        │   │
│ └──────────────────────────────────────┘   │
└────────────────────────────────────────────┘
```

Ao clicar **Selecionar** em um card:
- `geo_latitude` e `geo_longitude` são preenchidos no formulário
- Dialog fecha
- Toast de confirmação: `📍 wan1 — 201.33.x.x (São Paulo, SP) selecionado`

A bandeira do país é exibida usando `flag-icons` (já instalado no projeto: `fi fi-{country_code_lowercase}`).

---

## Arquivos modificados

| Arquivo | Operação |
|---|---|
| `supabase/functions/resolve-firewall-geo/index.ts` | Modificar — retornar todos os IPs + dados geo enriquecidos |
| `src/pages/environment/AddFirewallPage.tsx` | Modificar — novo estado, dialog de seleção, handler atualizado |

## Nenhuma migração de banco necessária
Os campos `geo_latitude` e `geo_longitude` já existem na tabela `firewalls`.
