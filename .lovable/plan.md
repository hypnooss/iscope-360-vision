

# Fix: Agent Nao Consegue Reiniciar o Proprio Servico

## Problema

O botao "Verificar Componentes" funciona assim:
1. Backend envia `check_components: true` no heartbeat
2. Agent cria `/var/lib/iscope-agent/check_components.flag`
3. Agent tenta `systemctl restart iscope-agent`
4. **FALHA**: O agent roda como user `iscope`, que nao tem permissao para executar `systemctl restart`
5. O `check-deps.sh` (que so roda no `ExecStartPre` durante o start do servico) nunca executa
6. O certificado nunca e gerado, e o backend continua pedindo a cada heartbeat

## Causa Raiz

O script de instalacao (`agent-install`) nao configura uma regra sudoers para permitir que o user `iscope` reinicie o servico.

## Solucao

Duas mudancas:

### 1. Script de Instalacao: Adicionar regra sudoers

Adicionar ao `agent-install/index.ts`, na funcao `write_systemd_service()` (ou em uma funcao nova chamada logo apos), a criacao de um arquivo sudoers que permite ao user `iscope` reiniciar apenas o servico `iscope-agent`:

```text
/etc/sudoers.d/iscope-agent
Conteudo: iscope ALL=(ALL) NOPASSWD: /bin/systemctl restart iscope-agent
```

Isso e seguro porque:
- Permite apenas o comando especifico `systemctl restart iscope-agent`
- Nao abre nenhum outro acesso
- Padrao comum para servicos que precisam de auto-restart

### 2. Agent Python: Usar `sudo` no restart

Alterar `main.py` (linha 99) para usar `sudo systemctl restart iscope-agent` em vez de `systemctl restart iscope-agent`.

De:
```text
subprocess.run(
    ['systemctl', 'restart', 'iscope-agent'],
    capture_output=True,
    timeout=30
)
```

Para:
```text
subprocess.run(
    ['sudo', 'systemctl', 'restart', 'iscope-agent'],
    capture_output=True,
    timeout=30
)
```

### 3. Agent Python: Logar erros do restart

Adicionar log se o `subprocess.run` retornar erro, para facilitar debug futuro:

```text
result = subprocess.run(
    ['sudo', 'systemctl', 'restart', 'iscope-agent'],
    capture_output=True,
    timeout=30
)
if result.returncode != 0:
    stderr = result.stderr.decode() if result.stderr else ''
    self.logger.warning(f"Falha ao reiniciar servico: {stderr}")
```

## Efeito nos Agents ja Instalados

Agents ja instalados NAO terao a regra sudoers automaticamente. Para corrigir agents existentes, o operador deve executar manualmente no servidor:

```text
echo 'iscope ALL=(ALL) NOPASSWD: /bin/systemctl restart iscope-agent' | sudo tee /etc/sudoers.d/iscope-agent
sudo chmod 440 /etc/sudoers.d/iscope-agent
```

Ou executar `agent-install --update` que ira reescrever o arquivo sudoers.

## Arquivos Modificados

| Arquivo | Mudanca |
|---------|---------|
| `supabase/functions/agent-install/index.ts` | Adicionar funcao para criar `/etc/sudoers.d/iscope-agent` e chama-la no `main()` |
| `python-agent/main.py` | Usar `sudo systemctl restart` e logar erros |

