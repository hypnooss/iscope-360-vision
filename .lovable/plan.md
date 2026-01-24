
# Plano: Ajustes Finais na Tela de Análise de Compliance

## Resumo das Alterações Solicitadas

1. **Aumentar espaçamento entre categorias** - Atualmente `mb-6`, aumentar para `mb-10`
2. **Diminuir altura dos cards de estatísticas** - Reduzir padding dos StatCards
3. **Adicionar informações de identificação do firewall** - Nome, URL e versão do firmware

---

## Modificações Detalhadas

### 1. Aumentar Espaçamento entre Categorias

**Arquivo:** `src/components/CategorySection.tsx`

**Alteração:**
- Linha 51: Alterar `mb-6` para `mb-10`

```tsx
// Antes
className="animate-slide-in mb-6"

// Depois  
className="animate-slide-in mb-10"
```

---

### 2. Diminuir Altura dos Cards de Estatísticas

**Arquivo:** `src/components/StatCard.tsx`

**Alteração:**
- Linha 37: Alterar padding de `p-5` para `p-4`
- Linha 45: Reduzir tamanho do valor de `text-3xl` para `text-2xl`
- Linha 49: Reduzir padding do ícone de `p-3` para `p-2`
- Linha 50: Reduzir tamanho do ícone de `w-6 h-6` para `w-5 h-5`

```tsx
// Antes
<div className={cn("glass-card rounded-xl p-5 border...")}>
  ...
  <p className={cn("text-3xl font-bold tabular-nums", ...)}>
  ...
  <div className={cn("p-3 rounded-lg", ...)}>
    <Icon className="w-6 h-6" />

// Depois
<div className={cn("glass-card rounded-xl p-4 border...")}>
  ...
  <p className={cn("text-2xl font-bold tabular-nums", ...)}>
  ...
  <div className={cn("p-2 rounded-lg", ...)}>
    <Icon className="w-5 h-5" />
```

---

### 3. Adicionar Informações do Firewall

**Arquivo:** `src/components/Dashboard.tsx`

**Alterações necessárias:**

#### 3.1 Atualizar Props do Dashboard

Adicionar novas props para receber informações do firewall:

```tsx
interface DashboardProps {
  report: ComplianceReport;
  onRefresh: () => void;
  isRefreshing: boolean;
  onDisconnect?: () => void;
  // Novas props
  firewallName?: string;
  firewallUrl?: string;
}
```

#### 3.2 Adicionar Card de Identificação do Firewall

Inserir um card informativo acima ou abaixo dos stats, contendo:
- Nome do Firewall
- URL do FortiGate
- Versão do Firmware (já disponível em `report.firmwareVersion`)

```tsx
{/* Firewall Info Card - acima dos stats */}
<div className="glass-card rounded-lg p-4 mb-4 border-primary/20">
  <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
    <div className="flex items-center gap-2">
      <Shield className="w-4 h-4 text-primary" />
      <span className="text-muted-foreground">Firewall:</span>
      <span className="font-medium text-foreground">{firewallName || 'N/A'}</span>
    </div>
    <div className="flex items-center gap-2">
      <Globe className="w-4 h-4 text-primary" />
      <span className="text-muted-foreground">URL:</span>
      <span className="font-medium text-foreground">{firewallUrl || 'N/A'}</span>
    </div>
    {report.firmwareVersion && (
      <div className="flex items-center gap-2">
        <Cpu className="w-4 h-4 text-primary" />
        <span className="text-muted-foreground">FortiOS:</span>
        <span className="font-medium text-foreground">v{report.firmwareVersion}</span>
      </div>
    )}
  </div>
</div>
```

#### 3.3 Atualizar FirewallAnalysis.tsx

Passar as novas props para o Dashboard:

```tsx
<Dashboard
  report={report}
  onRefresh={handleRefresh}
  isRefreshing={isRefreshing}
  firewallName={firewall?.name}
  firewallUrl={firewall?.fortigate_url}
/>
```

---

## Resultado Visual Esperado

```text
+----------------------------------------------------------+
| Análise de Compliance                    [PDF] [Reanalisar]|
| Relatório gerado em 24/01/2026                            |
+----------------------------------------------------------+
| 🛡️ Firewall: FW-Matriz  |  🌐 URL: https://fw.empresa.com |
| 💻 FortiOS: v7.2.10                                        |
+----------------------------------------------------------+
|  [SCORE]  |  [Total] [Aprovadas] [Falhas] [Alertas]       |
|    85%    |   35       28          5         2            |
+----------------------------------------------------------+

       ↕️ mb-10 (espaçamento maior)

+----------------------------------------------------------+
| Categoria 1...                                           |
+----------------------------------------------------------+

       ↕️ mb-10 (espaçamento maior)

+----------------------------------------------------------+
| Categoria 2...                                           |
+----------------------------------------------------------+
```

---

## Arquivos Afetados

| Arquivo | Alteração |
|---------|-----------|
| `src/components/CategorySection.tsx` | Aumentar margin-bottom de `mb-6` para `mb-10` |
| `src/components/StatCard.tsx` | Reduzir padding e tamanhos de fonte/ícone |
| `src/components/Dashboard.tsx` | Adicionar props e card de identificação do firewall |
| `src/pages/FirewallAnalysis.tsx` | Passar novas props para o Dashboard |
