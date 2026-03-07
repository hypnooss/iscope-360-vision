

## Exibir KPIs apenas nas abas correspondentes

### Problema

A barra de KPIs (Logins de Risco, Falhas MFA, Login Geo. Anômalo, etc.) aparece sempre, independente da aba selecionada. Esses KPIs são métricas de incidentes/anomalias e não fazem sentido quando o usuário está na aba **Proteção** ou **Movimento Externo**.

### Solução

Controlar a visibilidade do `AnalyzerKPIRow` com base na aba ativa. Mover a renderização dos KPIs para dentro das `TabsContent` de **Incidentes** e **Anomalias**, ou alternativamente, rastrear a aba ativa com state e condicionar a renderização.

### Alteração

**`src/pages/m365/M365AnalyzerDashboardPage.tsx`** — 1 arquivo

1. Adicionar estado `activeTab` para rastrear a aba selecionada:
   ```ts
   const [activeTab, setActiveTab] = useState('incidents');
   ```

2. Passar `onValueChange={setActiveTab}` no componente `<Tabs>` (linha ~682).

3. Condicionar a renderização do `AnalyzerKPIRow` (linha ~647) para só aparecer nas abas `incidents` e `anomalies`:
   ```tsx
   {snapshot && m && (activeTab === 'incidents' || activeTab === 'anomalies') && (
     <AnalyzerKPIRow metrics={m} activeFilter={kpiFilter} onFilter={setKpiFilter} />
   )}
   ```

4. Limpar o `kpiFilter` ao trocar de aba (para não manter um filtro ativo invisível):
   ```ts
   // dentro do onValueChange ou useEffect
   setKpiFilter(null);
   ```

