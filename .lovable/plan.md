
# Integrar Stadia Maps API Key — Configurações + Mapa

## Contexto

A Stadia Maps API key é uma **publishable key** (igual ao Mapbox/Google Maps) — ela é vinculada ao domínio e pode aparecer no frontend sem risco. O Stadia Maps explicitamente permite isso. Portanto, o fluxo é:

1. Admin salva a key em Configurações > Chaves de API
2. Key fica armazenada criptografada no banco (padrão já existente)
3. Frontend busca a key via edge function e monta a URL do tile dinamicamente

## Arquitetura

O projeto já tem toda a infraestrutura pronta:
- **`manage-api-keys`** — edge function que gerencia keys (GET lista, POST salva)
- **`system_settings`** — tabela onde as keys ficam salvas (criptografadas)
- **SettingsPage** — UI que já renderiza todas as keys de `MANAGED_KEYS` automaticamente

Basta adicionar `STADIA_MAPS_API_KEY` em dois lugares e fazer o `AttackMap` usar a key.

## Mudanças por Arquivo

### 1. `supabase/functions/manage-api-keys/index.ts`

Adicionar a entry na lista `MANAGED_KEYS`:

```typescript
{
  name: "STADIA_MAPS_API_KEY",
  label: "Stadia Maps",
  description: "API Key do Stadia Maps para exibição do mapa de ataques (tiles do mapa escuro). Obtenha em client.stadiamaps.com",
},
```

A aba "Chaves de API" em Configurações renderiza automaticamente todos os itens de `MANAGED_KEYS` — não há nenhuma mudança necessária na UI de settings.

### 2. Nova edge function `get-map-config/index.ts`

Uma edge function leve e pública (sem auth obrigatória, já que a key é publishable) que retorna a Stadia key descriptografada para o frontend montar a URL do tile:

```typescript
// Busca api_key_STADIA_MAPS_API_KEY em system_settings
// Descriptografa
// Retorna { stadia_api_key: "..." }
```

Por que uma edge function separada e não reutilizar `manage-api-keys`? Porque `manage-api-keys` exige `super_admin` — e o mapa de ataques é visível para usuários comuns. A nova função retorna **apenas** a key do mapa, sem expor as outras.

### 3. `src/components/firewall/AttackMap.tsx`

- Adicionar `useState` + `useEffect` para buscar a key via `supabase.functions.invoke('get-map-config')`
- Montar a `tileUrl` dinamicamente:
  - Se key disponível: `https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png?api_key=KEY`
  - Fallback: CartoDB Dark Matter (sem key, sempre funciona)
- Passar `tileUrl` para o `<TileLayer>`

### 4. Fallback visual

Se a key ainda não estiver configurada, o mapa cai automaticamente para CartoDB Dark Matter — o mapa continua funcionando.

## Fluxo Completo

```
Admin acessa Configurações > Chaves de API
  → Vê "Stadia Maps" na lista
  → Cola a API key e salva
  → manage-api-keys criptografa e salva em system_settings

Usuário abre o mapa de ataques
  → AttackMap chama get-map-config
  → get-map-config lê e descriptografa a key
  → AttackMap monta URL: ...alidade_smooth_dark/...?api_key=KEY
  → Tiles do Stadia Maps carregam corretamente
```

## Arquivos

| Arquivo | Ação |
|---|---|
| `supabase/functions/manage-api-keys/index.ts` | Adicionar `STADIA_MAPS_API_KEY` em `MANAGED_KEYS` |
| `supabase/functions/get-map-config/index.ts` | Criar — retorna a Stadia key descriptografada |
| `src/components/firewall/AttackMap.tsx` | Buscar key dinamicamente, montar URL, fallback para CartoDB |
