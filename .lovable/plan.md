

# Correcao: Cards de resumo devem refletir a aba ativa

## Problema

Os cards de resumo (Expirados, Expirando, Ativos, Total) sempre mostram a soma de **todas** as fontes (Firewalls + TLS + M365), independente da aba selecionada. O usuario espera que ao selecionar a aba "Firewalls", os cards mostrem apenas os numeros dos firewalls, e assim por diante.

## Solucao

### `src/pages/LicensingHubPage.tsx`

1. Trocar o `Tabs` de `defaultValue` para controlado com estado (`value` + `onValueChange`), criando um estado `activeTab`
2. Passar `activeTab` para o hook ou calcular o summary filtrado na pagina

### `src/hooks/useLicensingHub.ts`

3. Exportar os contadores separados por fonte (ou deixar o calculo na pagina)

### Abordagem escolhida (mais simples)

Manter o summary geral no hook, mas na **pagina** recalcular os numeros exibidos nos cards com base na aba ativa:

- Adicionar estado `const [activeTab, setActiveTab] = useState('firewalls')`
- Usar `Tabs value={activeTab} onValueChange={setActiveTab}`
- Criar um `useMemo` que calcula `displaySummary` baseado em `activeTab`:
  - `firewalls`: conta apenas `firewallLicenses` (forticare + services)
  - `tls`: conta apenas `tlsCertificates`
  - `m365`: conta apenas `m365Licenses`
- Usar `displaySummary` nos cards em vez de `summary`

### Arquivos alterados

| Arquivo | Alteracao |
|---|---|
| `src/pages/LicensingHubPage.tsx` | Adicionar estado `activeTab`, controlar Tabs, recalcular summary por aba ativa |

Nenhuma alteracao no hook necessaria.

