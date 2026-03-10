

## Nova abordagem: Mapa de países com bordas (choropleth) no Entra ID

### Mudança de conceito
Substituir o `AttackMap` (projéteis, ponto central, círculos) por um mapa choropleth simples que destaca os países com login bem-sucedido, desenhando suas fronteiras com preenchimento verde translúcido.

### Alterações

**1. Criar `src/components/m365/entra-id/EntraIdCountryMap.tsx`** (novo componente)
- Mapa Leaflet com tile layer dark (mesmo tile do AttackMap, com fallback CARTO)
- Carregar GeoJSON de fronteiras do mundo via CDN (`https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json` convertido, ou usar um GeoJSON leve hospedado)
- Alternativa mais simples: usar um GeoJSON estático inline simplificado, ou buscar de `https://raw.githubusercontent.com/johan/world.geo.json/master/countries.geo.json`
- Para cada país com login com sucesso, encontrar o feature correspondente no GeoJSON pelo ISO code e renderizar com `react-leaflet` `GeoJSON` component com `style={{ fillColor: '#22c55e', fillOpacity: 0.35, color: '#22c55e', weight: 1.5 }}`
- Tooltip ao hover mostrando nome do país + contagem de logins
- Sem animações, sem ponto central, sem dados de falha

**2. Reescrever `src/components/m365/entra-id/EntraIdLoginMap.tsx`**
- Trocar `AttackMap` pelo novo `EntraIdCountryMap`
- Remover props de `loginCountriesFailed` (ou ignorar)
- Remover referências ao `AttackMapFullscreen`, `ENTRA_LOCATION`, `ENTRA_LABEL_MAP`
- Manter layout externo (título uppercase, link tela cheia)
- Legenda simplificada: apenas "Login com Sucesso (N)"
- Fullscreen: usar o mesmo `EntraIdCountryMap` com `fullscreen={true}` em um overlay próprio (dialog/portal simples), sem o painel lateral do AttackMapFullscreen

**3. Abordagem para GeoJSON**
- Fetch do GeoJSON de um CDN público no `useEffect` e cachear com `useRef`
- Mapear país name → ISO code usando `getCountryCode` existente
- O GeoJSON do `world.geo.json` usa `properties.name` que pode ser mapeado

### Dependências
- Nenhuma nova — `react-leaflet` já possui o componente `GeoJSON` built-in

