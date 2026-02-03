

# Plano: Corrigir Problema do Certificado TLS no Agent

## Problema Identificado

O agent está falhando com o erro:
```
OSError: Could not find a suitable TLS CA certificate bundle, invalid path: /opt/iscope-agent/venv/lib64/python3.9/site-packages/certifi/cacert.pem
```

**Causa**: O pacote `certifi` foi instalado a partir do cache do pip, mas o arquivo `cacert.pem` não foi extraído corretamente.

## Solução Imediata (execute no servidor)

Rode os comandos abaixo para corrigir manualmente:

```bash
# Parar o serviço
sudo systemctl stop iscope-agent

# Reinstalar certifi forçando download limpo
/opt/iscope-agent/venv/bin/pip uninstall certifi -y
/opt/iscope-agent/venv/bin/pip install --no-cache-dir certifi

# Verificar se o arquivo existe agora
ls -la /opt/iscope-agent/venv/lib64/python3.9/site-packages/certifi/cacert.pem

# Reiniciar o serviço
sudo systemctl start iscope-agent

# Verificar logs
journalctl -u iscope-agent -f --no-pager
```

---

## Solução Permanente (alteração no script)

Modificar o script de instalação para usar `--no-cache-dir` ao instalar dependências, garantindo que os pacotes sejam sempre baixados frescos.

### Arquivo: `supabase/functions/agent-install/index.ts`

**Alteração na função `setup_venv()` (linhas 360-368):**

**De:**
```bash
"$INSTALL_DIR/venv/bin/pip" install --upgrade pip

# Offline bundle support: if wheels/ exists, install without hitting PyPI
if [[ -d "$INSTALL_DIR/wheels" ]] && compgen -G "$INSTALL_DIR/wheels/*.whl" >/dev/null 2>&1; then
  echo "Instalando dependências (offline wheels bundle)..."
  "$INSTALL_DIR/venv/bin/pip" install --no-index --find-links "$INSTALL_DIR/wheels" -r "$INSTALL_DIR/requirements.txt"
else
  "$INSTALL_DIR/venv/bin/pip" install -r "$INSTALL_DIR/requirements.txt"
fi
```

**Para:**
```bash
"$INSTALL_DIR/venv/bin/pip" install --upgrade pip

# Offline bundle support: if wheels/ exists, install without hitting PyPI
if [[ -d "$INSTALL_DIR/wheels" ]] && compgen -G "$INSTALL_DIR/wheels/*.whl" >/dev/null 2>&1; then
  echo "Instalando dependências (offline wheels bundle)..."
  "$INSTALL_DIR/venv/bin/pip" install --no-index --find-links "$INSTALL_DIR/wheels" -r "$INSTALL_DIR/requirements.txt"
else
  # Use --no-cache-dir to avoid issues with corrupted cached packages (e.g., certifi missing cacert.pem)
  "$INSTALL_DIR/venv/bin/pip" install --no-cache-dir -r "$INSTALL_DIR/requirements.txt"
fi
```

---

## Sobre os Logs

O arquivo de log não existe mais porque o agent foi atualizado para usar apenas `journalctl` por padrão.

**Como ver os logs:**
```bash
# Logs em tempo real
journalctl -u iscope-agent -f --no-pager

# Últimas 100 linhas
journalctl -u iscope-agent -n 100 --no-pager

# Logs desde hoje
journalctl -u iscope-agent --since today
```

**Opcional**: Se você quiser um arquivo de log, adicione ao `/etc/iscope/agent.env`:
```
AGENT_LOG_FILE=/var/log/iscope/agent.log
```

---

## Resumo

| Ação | Tipo |
|------|------|
| Reinstalar certifi manualmente | Correção imediata |
| Adicionar `--no-cache-dir` ao pip install | Correção permanente |

---

## Próximos Passos

1. Execute a **solução imediata** no servidor para corrigir o agent agora
2. Depois que confirmar que está funcionando, aprove a **solução permanente** para evitar o problema em futuras instalações

