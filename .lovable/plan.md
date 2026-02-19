
# Refazer a Legenda do Painel Lateral do Mapa Fullscreen

## Problema

1. **Painel lateral direito desconexo**: Ainda mostra "Top Origens de Ataque" (FW+VPN misturados) e "Top IPs Bloqueados" -- categorias antigas que nao refletem a separacao atual de dados (Auth FW, Auth VPN, Saida Permitida, Saida Bloqueada).

2. **4.232 Falha Auth FW sem circulos no mapa**: Correto -- a maioria dos IPs de autenticacao administrativa sao privados (RFC1918), sem geolocalizacao possivel. O usuario quer que isso fique claro na legenda.

## Nova Estrutura do Painel Lateral Direito

O painel sera reestruturado para ter secoes que espelham as camadas do mapa, cada uma com cor correspondente e contagem. Quando os dados geolocalizados forem menores que o total (IPs privados), exibira uma nota discreta.

```text
+-------------------------------+
| FALHA AUTH FW        (#dc2626)|
| (vermelho escuro)             |
| 1  [flag] United States   136 |
| 2  [flag] Latvia           56 |
| ...                           |
| * 3.987 de IPs privados       |
+-------------------------------+
| FALHA AUTH VPN       (#eab308)|
| (amarelo)                     |
| 1  [flag] Country          XX |
| ...                           |
+-------------------------------+
| SUCESSO AUTH FW      (#22c55e)|
| (verde)                       |
| 1  [flag] Country          XX |
| ...                           |
+-------------------------------+
| SAIDA PERMITIDA      (#38bdf8)|
| (azul)                        |
| 1  [flag] Country          XX |
| ...                           |
+-------------------------------+
| SAIDA BLOQUEADA      (#ef4444)|
| (vermelho claro)              |
| 1  [flag] Country          XX |
| ...                           |
+-------------------------------+
```

Secoes sem dados serao ocultadas. A nota de "IPs privados" aparecera quando o total de eventos for significativamente maior que a soma dos paises geolocalizados (ex: 4232 total, mas so 245 geolocalizados = 3987 de IPs privados).

## Mudancas Tecnicas

### Arquivo: `src/components/firewall/AttackMapFullscreen.tsx`

**1. Adicionar props para os rankings FW-especificos:**
- `topFwAuthCountriesFailed` (ja temos `authFailedCountries` que e esse dado)
- `topVpnAuthCountriesFailed` (ja temos `authFailedVpnCountries`)
- `topFwAuthCountriesSuccess` (ja temos `authSuccessCountries`)

As props existentes ja carregam os dados corretos, entao so precisamos reestruturar o JSX.

**2. Substituir o painel lateral (linhas 110-170):**

Remover:
- "Top Origens de Ataque" (merged)
- "Top Destinos (Saida)" 
- "Top IPs Bloqueados"

Adicionar secoes separadas por categoria, cada uma com:
- Titulo com bolinha colorida da camada correspondente
- Top 5 paises com bandeiras
- Nota de "IPs privados" quando `total - somaGeo > 0`

**3. Tornar o painel scrollable** com `max-h-[calc(100vh-160px)] overflow-y-auto` para acomodar mais secoes.

### Arquivo: `src/pages/firewall/AnalyzerDashboardPage.tsx`

Nenhuma alteracao -- as props ja sao passadas corretamente.

## Resultado Visual

O painel lateral refletira exatamente as mesmas categorias e cores da barra inferior, com rankings de paises detalhados por camada. Quando houver muitos eventos de IPs privados (como as 4232 falhas de Auth FW no OCI-FW), uma nota discreta explicara por que nao aparecem circulos no mapa.

## Arquivos a Modificar

| Arquivo | Mudanca |
|---|---|
| `src/components/firewall/AttackMapFullscreen.tsx` | Reestruturar painel lateral com secoes por categoria + nota de IPs privados |
