

## Plano: Ajustar requirements.txt para compatibilidade com Python 3.8

### Diagnóstico
O Python 3.8 do SCL agora é detectado corretamente. Porém, algumas dependências no `requirements.txt` exigem Python 3.9+:

- **`dnspython>=2.7.0`** — versão 2.7+ requer Python 3.9+. A última compatível com 3.8 é **2.6.1**
- Outras dependências podem ter o mesmo problema (ex: `pysnmp>=6.0.0`, `requests>=2.31.0`, `certifi>=2024.2.2`)

### Solução
Ajustar os limites de versão no `requirements.txt` para serem compatíveis com Python 3.8:

| Pacote | Atual | Novo |
|--------|-------|------|
| `dnspython` | `>=2.7.0` | `>=2.4.0,<2.7.0` |

Os demais pacotes (`requests`, `certifi`, `pyjwt`, `paramiko`, `pysnmp`, `schedule`, `urllib3`, `websocket-client`) têm versões compatíveis com Python 3.8 nos ranges atuais, pois o pip já listou `requests` até 2.27.1 antes (esse era o erro com Python 3.6, não 3.8 — com 3.8, requests 2.31+ está disponível).

### Arquivo alterado

| Arquivo | Mudança |
|---------|---------|
| `python-agent/requirements.txt` | `dnspython>=2.7.0` → `dnspython>=2.4.0,<2.7.0` |

### Observação
O `requirements.txt` também precisa ser atualizado no **storage bucket** (`agent-releases`) como fallback, pois o `agent-fix` pode baixá-lo de lá se não estiver incluído nos pacotes tar.gz. Após a alteração no código, será necessário fazer upload do novo `requirements.txt` para o bucket.

