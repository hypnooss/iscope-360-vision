

# Redesign da pagina Firewall > Firewalls no estilo de Agendamentos

## Resumo

Refatorar os cards de estatisticas e a tabela de firewalls para seguir o mesmo layout e estilo visual da pagina Administracao > Agendamentos, incluindo cards compactos, barra de busca com filtros e badges coloridos na tabela.

## Mudancas detalhadas

### Arquivo: `src/pages/firewall/FirewallListPage.tsx`

#### 1. Substituir FirewallStatsCards por cards inline (estilo Agendamentos)

Remover o componente `FirewallStatsCards` e criar cards compactos diretamente na pagina, identicos ao layout de Agendamentos:
- Icone + numero grande + label pequeno
- Grid de 4 colunas (Firewalls, Score Medio, Alertas Criticos, Falhas Criticas)
- Calcular as stats localmente a partir dos dados ja carregados em `firewalls[]`

#### 2. Adicionar barra de busca + filtros (entre cards e tabela)

Identico ao padrao de Agendamentos:
- Input de busca com icone `Search` e placeholder "Buscar ativo..."
- Filtros opcionais (apenas para super roles): Fabricante, Frequencia de agendamento
- Layout: flex row com gap

#### 3. Refatorar tabela com badges coloridos

Seguir o mesmo estilo visual de badges da tabela de Agendamentos:
- **Firewall**: nome em font-medium (sem description inline)
- **Workspace**: texto em text-muted-foreground
- **Fabricante**: Badge colorido (laranja para Fortinet, etc.)
- **Agent**: Badge outline colorido
- **Frequencia**: Badge com cores por tipo (azul=diario, roxo=semanal, amber=mensal) - mesmo mapa de cores do Agendamentos
- **Programacao**: texto descritivo (ex: "Todos os dias as 02:00")
- **Ultimo Score**: Badge com cor por faixa (verde >=75, amarelo >=60, vermelho <60)
- **Acoes**: botoes ghost (play, edit, delete) - mantidos como estao

#### 4. Remover o card wrapper da tabela

No Agendamentos a tabela fica dentro de um `Card` com `CardContent p-0` (sem header de card separado). Aplicar o mesmo padrao, removendo o `CardHeader` com titulo "Lista de Firewalls".

### Secao tecnica

**Imports a adicionar**: `Search`, `Clock` de lucide-react; `useMemo`

**Imports a remover**: `FirewallStatsCards` (componente externo)

**Calculo de stats inline**:
```
const stats = useMemo(() => {
  const total = firewalls.length;
  const withScore = firewalls.filter(f => f.last_score !== null);
  const avg = withScore.length > 0
    ? Math.round(withScore.reduce((s, f) => s + (f.last_score || 0), 0) / withScore.length)
    : 0;
  const critical = firewalls.filter(f => f.last_score !== null && f.last_score < 50).length;
  const failures = firewalls.filter(f => f.last_score !== null && f.last_score < 30).length;
  return { total, avg, critical, failures };
}, [firewalls]);
```

**Filtro de busca**:
```
const [search, setSearch] = useState('');
const filtered = useMemo(() => {
  if (!search) return firewalls;
  const q = search.toLowerCase();
  return firewalls.filter(fw =>
    fw.name.toLowerCase().includes(q) ||
    fw.clients?.name?.toLowerCase().includes(q)
  );
}, [firewalls, search]);
```

**Cores de frequencia** (mesmo mapa do Agendamentos):
```
const FREQUENCY_COLORS = {
  daily: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  weekly: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
  monthly: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
};
```

**Colunas da tabela resultante**:
Firewall | Workspace | Fabricante | Agent | Frequencia | Programacao | Ultimo Score | Acoes

