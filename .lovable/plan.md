
# Plano: Flag de Verificacao de Componentes por Agent Individual

## Resumo

Implementar uma flag `check_components` individual por agent (em vez de global), permitindo que o administrador acione a verificacao de componentes de sistema especificamente para cada agent atraves de um botao no modal de detalhes.

---

## Arquitetura

```text
Modal Detalhes do Agent                    Backend (heartbeat)
        |                                        |
        | 1. Click "Verificar Componentes"       |
        |--------------------------------------->|
        |                                        |
        | 2. UPDATE agents SET                   |
        |    check_components = true             |
        |                                        |
        |                                        |
Agent envia heartbeat                            |
        |<---------------------------------------|
        |                                        |
        | 3. Response com check_components: true |
        |--------------------------------------->|
        |                                        |
        | 4. Agent executa ensure_system_        |
        |    components() e reseta flag          |
        |                                        |
```

---

## Implementacao

### 1. Migracao: Adicionar coluna `check_components` na tabela `agents`

```sql
ALTER TABLE agents 
ADD COLUMN check_components boolean NOT NULL DEFAULT false;
```

---

### 2. Backend: `supabase/functions/agent-heartbeat/index.ts`

**Adicionar campo na interface:**

```typescript
// Linha ~24: Adicionar ao HeartbeatSuccessResponse
interface HeartbeatSuccessResponse {
  // ... campos existentes ...
  check_components: boolean;  // NOVO
}
```

**Buscar a flag do agent e resetar apos enviar:**

```typescript
// Apos linha ~430 (query do agent para certificado)
// Atualizar query para incluir check_components
const { data: agentData } = await supabase
  .from('agents')
  .select('azure_certificate_key_id, check_components')
  .eq('id', agentId)
  .single();

const checkComponents = agentData?.check_components || false;

// Se check_components esta true, resetar para false apos enviar
if (checkComponents) {
  await supabase
    .from('agents')
    .update({ check_components: false })
    .eq('id', agentId);
  console.log(`Reset check_components flag for agent ${agentId}`);
}
```

**Incluir no response:**

```typescript
// Linha ~467: Adicionar ao response
const response: HeartbeatSuccessResponse = {
  // ... campos existentes ...
  check_components: checkComponents,
};
```

---

### 3. Frontend: `src/pages/AgentsPage.tsx`

**Adicionar estados para o botao:**

```typescript
// Apos linha ~110
const [checkingComponents, setCheckingComponents] = useState(false);
```

**Adicionar handler para acionar verificacao:**

```typescript
const handleCheckComponents = async () => {
  if (!selectedAgent) return;

  setCheckingComponents(true);
  try {
    const { error } = await supabase
      .from("agents")
      .update({ check_components: true })
      .eq("id", selectedAgent.id);

    if (error) throw error;

    toast.success("Verificacao de componentes agendada! O agent executara no proximo heartbeat.");
    fetchData();
  } catch (error: any) {
    toast.error("Erro ao agendar verificacao: " + error.message);
  } finally {
    setCheckingComponents(false);
  }
};
```

**Adicionar botao no modal de detalhes (apos linha ~759, antes do fechamento da secao de codigo de ativacao):**

```tsx
{/* Botao de verificacao de componentes */}
{!selectedAgent.revoked && selectedAgent.last_seen && (
  <div className="pt-4 border-t border-border/50">
    <div className="flex items-center justify-between">
      <div>
        <Label>Componentes do Sistema</Label>
        <p className="text-sm text-muted-foreground">
          Verifica e instala PowerShell, modulos M365 e certificados
        </p>
      </div>
      <Button 
        size="sm" 
        variant="outline" 
        onClick={handleCheckComponents} 
        disabled={checkingComponents}
      >
        {checkingComponents ? (
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        ) : (
          <RefreshCw className="w-4 h-4 mr-2" />
        )}
        Verificar Componentes
      </Button>
    </div>
  </div>
)}
```

---

### 4. Agent: `python-agent/main.py`

**Adicionar logica para reagir a flag (apos linha ~86):**

```python
# Verificar componentes se solicitado pelo backend
if result.get('check_components'):
    self.logger.info("Backend solicitou verificacao de componentes")
    from agent.components import ensure_system_components
    try:
        ensure_system_components(self.logger)
    except Exception as e:
        self.logger.warning(f"Erro ao verificar componentes: {e}")
```

---

### 5. Versao: `python-agent/agent/version.py`

```python
__version__ = "1.2.2"
```

---

## Fluxo de Uso

1. Admin abre modal de detalhes do agent
2. Clica em "Verificar Componentes"
3. Frontend faz UPDATE na tabela agents: `check_components = true`
4. Agent recebe `check_components: true` no proximo heartbeat
5. Agent executa `ensure_system_components()`:
   - Instala PowerShell se ausente
   - Instala modulos M365 se ausentes
   - Gera certificado se ausente
6. Backend reseta flag para `false` apos enviar no response
7. Proximo heartbeat reporta capabilities e certificado

---

## Vantagens da Abordagem Individual

| Aspecto | Flag Global | Flag por Agent |
|---------|-------------|----------------|
| Controle | Todos de uma vez | Granular por agent |
| Uso | Emergencia/deploy massivo | Troubleshooting individual |
| Reset | Manual via SQL | Automatico apos execucao |
| UI | Via Settings | Direto no modal do agent |

---

## Arquivos a Modificar

| Arquivo | Alteracao |
|---------|-----------|
| Migracao SQL | Adicionar coluna `check_components` |
| `supabase/functions/agent-heartbeat/index.ts` | Ler e resetar flag, incluir no response |
| `src/pages/AgentsPage.tsx` | Botao no modal de detalhes |
| `python-agent/main.py` | Reagir a flag e chamar `ensure_system_components()` |
| `python-agent/agent/version.py` | Atualizar para 1.2.2 |

---

## Secao Tecnica

### Comportamento do Reset Automatico

A flag e resetada para `false` pelo backend imediatamente apos incluir no response. Isso garante que:
- O agent executa a verificacao apenas uma vez
- Nao ha loop infinito de verificacoes
- Se o agent falhar, o admin pode clicar novamente

### Condicao de Exibicao do Botao

O botao so aparece se:
- Agent nao esta revogado (`!selectedAgent.revoked`)
- Agent ja se conectou pelo menos uma vez (`selectedAgent.last_seen`)

Isso evita mostrar o botao para agents pendentes que ainda nao tem o codigo instalado.

### Atualizacao do Types

A coluna `check_components` sera adicionada ao banco e o tipo `agents` sera atualizado automaticamente apos a migracao.
