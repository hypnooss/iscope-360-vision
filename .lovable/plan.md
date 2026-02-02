
# Plano: Ajustar Layout de Status no Dashboard de Firewall

## Problema

No Dashboard de Firewall (`src/components/Dashboard.tsx`), os indicadores de status (Firmware, Licenciamento, MFA) estão sendo exibidos em uma **única linha horizontal** usando `flex flex-wrap`, enquanto no Dashboard de Domínio Externo cada indicador aparece em sua **própria linha** usando o componente `DetailRow`.

**Atual (Firewall):**
```
MODELO        FG120G
SERIAL        FG120GTK24005216
FORTIOS       v7.4.10
HOSTNAME      AAX-FW-01
UPTIME        3d 19h 3m
URL           https://10.25.11.250:40443
FIRMWARE ● Atualizado    LICENCIAMENTO ● Ativo    MFA ● Inativo  ← 3 em 1 linha
```

**Esperado (igual Domínio Externo):**
```
MODELO        FG120G
SERIAL        FG120GTK24005216
FORTIOS       v7.4.10
HOSTNAME      AAX-FW-01
UPTIME        3d 19h 3m
URL           https://10.25.11.250:40443
FIRMWARE      ● Atualizado    ← linha individual
LICENCIAMENTO ● Ativo         ← linha individual
MFA           ● Inativo       ← linha individual
```

---

## Solução

1. **Remover o bloco duplicado** de "Versão do Firmware" (linhas 314-320)
2. **Substituir o container flex horizontal** por `DetailRow` individuais com `indicator`

---

## Arquivo a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/components/Dashboard.tsx` | Refatorar exibição de status para usar `DetailRow` com indicators |

---

## Alterações Detalhadas

### 1. Atualizar o componente `DetailRow` para suportar indicator (linhas ~58-75)

O `DetailRow` no Dashboard não possui suporte a `indicator` como no Domínio Externo. Precisa ser atualizado:

```typescript
interface DetailRowProps {
  label: string;
  value: string | string[];
  indicator?: "success" | "error";  // Adicionar
}

function DetailRow({ label, value, indicator }: DetailRowProps) {
  const isMultiline = Array.isArray(value);
  
  return (
    <div className="group">
      <div className="flex items-start gap-3 py-2">
        <span className="text-xs text-muted-foreground w-24 flex-shrink-0 uppercase tracking-wide pt-0.5">
          {label}
        </span>
        <div className="flex-1 min-w-0">
          {indicator && (
            <span 
              className={cn(
                "inline-block w-2 h-2 rounded-full mr-2",
                indicator === "success" 
                  ? "bg-emerald-400 shadow-[0_0_6px_hsl(142_76%_60%/0.5)]" 
                  : "bg-rose-400 shadow-[0_0_6px_hsl(0_72%_60%/0.5)]"
              )} 
            />
          )}
          {isMultiline ? (
            <div className="space-y-0.5">
              {value.map((v, i) => (
                <div key={i} className="text-sm font-medium text-foreground">{v}</div>
              ))}
            </div>
          ) : (
            <span className={cn("text-sm font-medium text-foreground", indicator && "inline-flex items-center")}>
              {value}
            </span>
          )}
        </div>
      </div>
      <div className="h-px bg-gradient-to-r from-border/50 via-border/20 to-transparent" />
    </div>
  );
}
```

### 2. Remover o bloco duplicado de Firmware Version (linhas 314-320)

```diff
- {/* Firmware Version Evidence Style */}
- {report.firmwareVersion && (
-   <div className="border-l-2 border-primary/30 pl-3 py-1.5 mt-2">
-     <p className="text-xs text-muted-foreground">Versão do Firmware</p>
-     <p className="text-sm font-mono text-foreground">v{report.firmwareVersion}</p>
-   </div>
- )}
```

### 3. Substituir o bloco flex de StatusRows (linhas 322-342)

**Antes:**
```tsx
{/* Status Indicators */}
<div className="flex flex-wrap gap-x-6 gap-y-2 mt-3">
  <StatusRow label="Firmware" isActive={statusInfo.firmwareUpToDate} ... />
  <StatusRow label="Licenciamento" isActive={statusInfo.licensingActive} ... />
  <StatusRow label="MFA" isActive={statusInfo.mfaEnabled} ... />
</div>
```

**Depois:**
```tsx
{/* Status Indicators - cada um em linha separada */}
<DetailRow 
  label="Firmware" 
  value={statusInfo.firmwareUpToDate ? "Atualizado" : "Desatualizado"}
  indicator={statusInfo.firmwareUpToDate ? "success" : "error"}
/>
<DetailRow 
  label="Licenciamento" 
  value={statusInfo.licensingActive ? "Ativo" : "Expirado"}
  indicator={statusInfo.licensingActive ? "success" : "error"}
/>
<DetailRow 
  label="MFA" 
  value={statusInfo.mfaEnabled ? "Ativo" : "Inativo"}
  indicator={statusInfo.mfaEnabled ? "success" : "error"}
/>
```

### 4. Remover o componente `StatusRow` (linhas ~77-102)

O componente `StatusRow` não será mais necessário e pode ser removido.

---

## Resultado Visual Esperado

```
MODELO        FG120G
SERIAL        FG120GTK24005216
FORTIOS       v7.4.10
HOSTNAME      AAX-FW-01
UPTIME        3d 19h 3m
URL           https://10.25.11.250:40443
FIRMWARE      ● Atualizado
LICENCIAMENTO ● Ativo
MFA           ● Inativo
```

Cada indicador de status em sua própria linha, com o glow verde (ativo) ou rosa (inativo), igual ao Dashboard de Domínio Externo.
