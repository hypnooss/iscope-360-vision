

# Geolocalizacao no Cadastro do Firewall

## Resumo

Adicionar campos `geo_latitude` e `geo_longitude` na tabela `firewalls` e nos formularios de cadastro/edicao. Um botao "Buscar Localizacao" ao lado dos campos resolve automaticamente as coordenadas a partir da URL do firewall (usando as mesmas tecnicas de DNS + ipapi.co ja existentes). No Analyzer Dashboard, o sistema usa as coordenadas cadastradas diretamente, eliminando a cadeia complexa de fallbacks.

## 1. Migracao de Banco de Dados

Adicionar duas colunas na tabela `firewalls`:

```sql
ALTER TABLE public.firewalls
  ADD COLUMN geo_latitude double precision,
  ADD COLUMN geo_longitude double precision;
```

Colunas nullable -- preenchimento opcional mas recomendado.

## 2. Formularios de Cadastro e Edicao

### Arquivos afetados:
- `src/pages/firewall/FirewallCreatePage.tsx`
- `src/pages/firewall/FirewallEditPage.tsx`
- `src/components/firewall/AddFirewallDialog.tsx` (dialog rapido na lista)

### Mudancas em cada formulario:

Adicionar ao `formData`:
- `geo_latitude: '' (string para input)`
- `geo_longitude: '' (string para input)`

Adicionar nova secao "Localizacao" no formulario, abaixo da URL:

```text
+------------------------------------------+
| Localizacao (opcional)                   |
| [Latitude____] [Longitude___] [Buscar]   |
|  Buscando...  ou  Localizacao encontrada |
+------------------------------------------+
```

- Dois inputs numericos lado a lado (latitude e longitude)
- Botao "Buscar Localizacao" (icone MapPin) que:
  1. Extrai o hostname da URL do firewall
  2. Se for IP publico, consulta ipapi.co diretamente
  3. Se for hostname, resolve DNS via dns.google e depois consulta ipapi.co
  4. Preenche os campos automaticamente
  5. Mostra feedback: loading spinner, sucesso ou erro
- Campos editaveis manualmente (usuario pode corrigir)

### Logica do botao "Buscar Localizacao"

Reutiliza a mesma estrategia ja implementada no AnalyzerDashboardPage:

```typescript
const handleFetchLocation = async () => {
  setGeoLoading(true);
  try {
    const url = new URL(formData.fortigate_url);
    const hostname = url.hostname;
    
    // Se for IP publico, consulta direto
    if (looksLikeIP(hostname) && !isPrivateIP(hostname)) {
      const geo = await tryGeolocate(hostname);
      if (geo) { setFormData({...formData, geo_latitude: geo.lat, geo_longitude: geo.lng}); return; }
    }
    
    // Resolve DNS
    const dnsRes = await fetch(`https://dns.google/resolve?name=${hostname}&type=A`);
    const dnsJson = await dnsRes.json();
    const ip = dnsJson?.Answer?.find(a => a.type === 1)?.data;
    if (ip) {
      const geo = await tryGeolocate(ip);
      if (geo) { setFormData({...formData, geo_latitude: geo.lat, geo_longitude: geo.lng}); return; }
    }
    
    toast.error('Nao foi possivel determinar a localizacao');
  } catch {
    toast.error('Erro ao buscar localizacao');
  } finally {
    setGeoLoading(false);
  }
};
```

### Salvar no banco

Incluir `geo_latitude` e `geo_longitude` no INSERT (create) e UPDATE (edit) do firewall. Converter string para `parseFloat` ou `null` se vazio.

## 3. Analyzer Dashboard -- Usar coordenadas cadastradas

### Arquivo: `src/pages/firewall/AnalyzerDashboardPage.tsx`

Simplificar a logica de geolocalizacao:

1. Buscar `geo_latitude` e `geo_longitude` do firewall selecionado (ja vem na query de firewalls)
2. Se ambos existirem, usar diretamente -- pular toda a cadeia de fallbacks
3. Se nao existirem, manter os fallbacks atuais como backup

```typescript
// Prioridade 0: coordenadas cadastradas
if (firewall?.geo_latitude && firewall?.geo_longitude) {
  return { lat: firewall.geo_latitude, lng: firewall.geo_longitude };
}
// ... fallbacks existentes (DNS, WAN IP, auth IPs)
```

## 4. Resumo de arquivos

| Arquivo | Acao |
|---------|------|
| Migracao SQL | Adicionar `geo_latitude` e `geo_longitude` na tabela `firewalls` |
| `FirewallCreatePage.tsx` | Adicionar campos lat/lng + botao "Buscar Localizacao" |
| `FirewallEditPage.tsx` | Adicionar campos lat/lng + botao "Buscar Localizacao" |
| `AddFirewallDialog.tsx` | Adicionar campos lat/lng + botao "Buscar Localizacao" |
| `AnalyzerDashboardPage.tsx` | Usar coordenadas cadastradas como prioridade, fallbacks como backup |

