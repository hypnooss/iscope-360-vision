
# Plano: Integrar Stats Cards no Card de Informações do Firewall

## Objetivo
Mover os 4 cards de estatísticas (Total de Verificações, Aprovadas, Falhas, Alertas) para dentro do card de informações do firewall, utilizando o espaço vazio abaixo dos dados do dispositivo.

---

## Layout Proposto

```text
+------------------+--------------------------------------------------+
|                  |  [FORTIGATE]  Nome: SAO-FW    | FortiOS: v7.2.10|
|       58         |              URL: https://... | Modelo: FGT40F  |
|     de 100       |              Serial: N/A      | Análise: 24/01  |
|   Risco Alto     |  +----------+----------+----------+----------+  |
|                  |  | Total 24 | Aprov 11 | Falhas 2 | Alert 11 |  |
|                  |  +----------+----------+----------+----------+  |
+------------------+--------------------------------------------------+
```

---

## Modificações

### Arquivo: `src/components/Dashboard.tsx`

1. **Remover a seção separada de Stats Cards** (linhas 126-156)

2. **Integrar os StatCards dentro do card de informações do firewall**:
   - Reorganizar o layout interno do card direito
   - Criar uma estrutura com:
     - Parte superior: Badge FortiGate + Grid de informações
     - Parte inferior: Grid com os 4 StatCards (compactos)

3. **Reduzir padding dos StatCards** quando dentro do card de informações:
   - Criar variante inline/compact ou simplesmente reduzir tamanho via classes

---

## Estrutura do Novo Card

```tsx
{/* Firewall Info + Stats combinados */}
<div className="lg:col-span-2 glass-card rounded-xl p-5 border border-primary/20 flex flex-col">
  {/* Parte superior: Info do Firewall */}
  <div className="flex items-start gap-4 mb-4">
    {/* Badge FortiGate */}
    <div className="hidden sm:flex ...">
      <ShieldCheck ... />
      <span>FORTIGATE</span>
    </div>
    
    {/* Grid de informações */}
    <div className="flex-1 grid grid-cols-2 gap-x-6 gap-y-1.5">
      {/* Nome, URL, Serial, FortiOS, Modelo, Análise */}
    </div>
  </div>
  
  {/* Separador visual */}
  <div className="border-t border-border/50 my-3" />
  
  {/* Parte inferior: Stats Cards compactos */}
  <div className="grid grid-cols-4 gap-3">
    <StatCard title="Total" value={24} icon={ListChecks} variant="default" compact />
    <StatCard title="Aprovadas" value={11} icon={CheckCircle} variant="success" compact />
    <StatCard title="Falhas" value={2} icon={XCircle} variant="destructive" compact />
    <StatCard title="Alertas" value={11} icon={AlertTriangle} variant="warning" compact />
  </div>
</div>
```

---

## Modificação do StatCard

### Arquivo: `src/components/StatCard.tsx`

Adicionar prop `compact` para renderização inline:

```tsx
interface StatCardProps {
  // ... props existentes
  compact?: boolean;
}

// Quando compact=true:
// - Padding menor: p-3 ao invés de p-4
// - Título menor: text-xs
// - Valor menor: text-xl ao invés de text-2xl
// - Ícone menor: w-4 h-4 ao invés de w-5 h-5
// - Layout mais horizontal
```

---

## Resultado Visual Esperado

- O card de informações do firewall ocupará toda a altura disponível ao lado do Score
- Os 4 stat cards ficarão alinhados na parte inferior desse card
- Layout mais compacto e eficiente, eliminando uma linha inteira da página
- Melhor aproveitamento do espaço visual

---

## Arquivos Afetados

| Arquivo | Alteração |
|---------|-----------|
| `src/components/Dashboard.tsx` | Integrar StatCards dentro do card de info do firewall |
| `src/components/StatCard.tsx` | Adicionar prop `compact` para versão reduzida |
