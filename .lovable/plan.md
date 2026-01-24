
# Plano: Aumentar Timeout do Cliente Python

## Diagnóstico

### O que aconteceu
1. O agente enviou o resultado da tarefa via POST `/agent-task-result`
2. O edge function processou tudo corretamente (~9 segundos):
   - Processou 24 regras de compliance
   - Salvou no `analysis_history`
   - Atualizou o firewall
   - **Criou o alerta** (nova operação)
3. O cliente Python tem timeout de **10 segundos** (linha 62 do `api_client.py`)
4. O processamento ultrapassou 10s, causando o erro de timeout

### Evidências de Sucesso
- ✅ Análise salva: `score=58` às `20:25:59`
- ✅ Alerta criado: "A análise do firewall SAO-FW foi concluída com score 58%"

O erro no log do agente é um **falso positivo** - tudo funcionou!

---

## Correção Proposta

### Arquivo: `python-agent/agent/api_client.py`

Aumentar o timeout do POST para 60 segundos, mantendo GET em 10s:

```python
# Linha 58-63: Aumentar timeout
response = requests.post(
    f"{self.base_url}{path}",
    json=json,
    headers=headers,
    timeout=60  # Aumentado de 10 para 60
)
```

### Alternativa: Timeout configurável por endpoint

Para maior flexibilidade, passar o timeout como parâmetro:

```python
def post(self, path, json=None, use_refresh_token=False, timeout=30):
    # ... código existente ...
    response = requests.post(
        f"{self.base_url}{path}",
        json=json,
        headers=headers,
        timeout=timeout
    )
```

E no `tasks.py`:

```python
def report_result(self, task_id: str, result: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    # ...
    return self.api.post('/agent-task-result', json=payload, timeout=60)
```

---

## Resumo das Alterações

| Arquivo | Alteração |
|---------|-----------|
| `python-agent/agent/api_client.py` | Aumentar timeout do POST de 10s para 60s |

---

## Observações

1. **Nenhum dado foi perdido** - A análise e o alerta já estão salvos
2. **O alerta já deve estar visível** - Recarregue a página para ver o banner
3. **Mudança simples** - Apenas uma linha precisa ser alterada
