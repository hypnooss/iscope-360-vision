

## Analise: `--update` no script de instalacao atual

Analisei o fluxo completo do `--update` e identifiquei **um problema critico** que impede o uso seguro:

### Problema: `write_env_file` sobrescreve o `ACTIVATION_CODE`

Quando se executa com `--update` (sem `--activation-code`), o script:

1. Define `ACTIVATION_CODE=""` (vazio, pois nao e obrigatorio no update)
2. Chama `write_env_file()` que faz `cat > $CONFIG_DIR/agent.env` com `AGENT_ACTIVATION_CODE=` **vazio**
3. O agent perde o activation code e nao consegue mais se registrar/autenticar

```text
ANTES do --update:
  /etc/iscope-agent/agent.env:
    AGENT_ACTIVATION_CODE=XXXX-YYYY-ZZZZ-WWWW  ✓

DEPOIS do --update (bug):
  /etc/iscope-agent/agent.env:
    AGENT_ACTIVATION_CODE=                       ✗ (vazio!)
```

### Prerequisito: Bucket

Alem disso, o bucket `agent-releases` precisa ter os dois pacotes separados **antes** de rodar o script:

| Arquivo | Status |
|---------|--------|
| `iscope-agent-latest.tar.gz` (so agent/, main.py, requirements.txt) | Precisa ser criado |
| `iscope-supervisor-latest.tar.gz` (so supervisor/) | Precisa ser criado |

Se o bucket ainda tiver o pacote unificado antigo, o script vai baixar arquivos com conteudo errado.

### Correcao proposta

Modificar `write_env_file()` em ambos os scripts (`agent-install` e `super-agent-install`) para **preservar o env file existente durante updates**:

```text
write_env_file() {
  local env_file="$CONFIG_DIR/agent.env"

  # Em modo --update, preservar o env existente
  if [[ "$UPDATE" -eq 1 ]] && [[ -f "$env_file" ]]; then
    echo "Modo update: preservando env file existente."
    # Apenas garantir que SUPABASE_URL e SUPABASE_ANON_KEY estejam presentes
    # (caso tenham sido adicionados em versoes mais recentes)
    grep -q "SUPABASE_URL=" "$env_file" || \
      echo "SUPABASE_URL=${SUPABASE_URL}" >> "$env_file"
    grep -q "SUPABASE_ANON_KEY=" "$env_file" || \
      echo "SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY}" >> "$env_file"
    return
  fi

  # Instalacao nova: criar env completo
  cat > "$env_file" <<EOF
  ...
  EOF
}
```

### Arquivos a modificar

| Arquivo | Mudanca |
|---------|---------|
| `supabase/functions/agent-install/index.ts` | `write_env_file()`: preservar env existente em modo `--update` |
| `supabase/functions/super-agent-install/index.ts` | Mesma mudanca |

### Resumo

Apos a correcao, o fluxo de `--update` sera:

```text
1. Para o servico existente
2. Instala dependencias do sistema (idempotente)
3. Baixa iscope-agent-latest.tar.gz + iscope-supervisor-latest.tar.gz
4. Limpa INSTALL_DIR (preserva venv, .env local, storage, logs)
5. Extrai ambos os pacotes em INSTALL_DIR
6. Recria venv e instala requirements.txt
7. PRESERVA o env file existente em /etc/iscope-agent/agent.env  ← corrigido
8. Reescreve systemd service + sudoers
9. Inicia o Supervisor (que inicia o Worker automaticamente)
```

