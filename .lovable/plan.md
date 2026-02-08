

# Plano: Corrigir Geração do PFX - Múltiplas Correções

## Diagnóstico Completo

Identifiquei **dois problemas** que impedem a geração do arquivo `.pfx`:

### Problema 1: O `check-deps.sh` não está instalado no servidor

O systemd está configurado para executar:
```
ExecStartPre=-/bin/bash /opt/iscope-agent/check-deps.sh
```

Mas o arquivo `check-deps.sh` **não existe** em `/opt/iscope-agent/` porque:
- Ele precisa estar incluído no tarball `iscope-agent-latest.tar.gz`
- O tarball é baixado de `https://akbosdbyheezghieiefz.supabase.co/storage/v1/object/public/agent-releases/`
- O tarball atual provavelmente foi criado **antes** do `check-deps.sh` ser adicionado ao repositório

### Problema 2: Lógica de fallback no `agent-install`

A função `generate_m365_certificate()` verifica se **todos os 3 arquivos** existem:
```bash
if [[ -f "$cert_file" ]] && [[ -f "$key_file" ]] && [[ -f "$pfx_file" ]]; then
    echo "Certificado M365 já existe, pulando geração..."
    return
fi
```

Isso está correto - deveria regenerar quando `.pfx` não existe. Mas a regeneração cria um **novo certificado** (`.crt` e `.key`), invalidando o thumbprint já registrado no Azure.

---

## Solução em 2 Partes

### Parte 1: Embutir o `check-deps.sh` diretamente no script de instalação

Em vez de depender do tarball, vou **gerar o arquivo `check-deps.sh` dinamicamente** durante a instalação, similar a como já é feito com o systemd unit file.

**Arquivo a modificar:**
- `supabase/functions/agent-install/index.ts`

**Alteração:**
- Adicionar função `write_check_deps_script()` que escreve o conteúdo do `check-deps.sh` diretamente em `/opt/iscope-agent/check-deps.sh`
- Chamar esta função em `main()` antes de `write_systemd_service()`

### Parte 2: Corrigir lógica de geração do PFX em instalações existentes

Para instalações onde `.crt` e `.key` já existem mas `.pfx` não, adicionar lógica para **gerar apenas o PFX** sem recriar todo o certificado:

```bash
generate_m365_certificate() {
  # ... definições de variáveis ...
  
  # Se cert e key existem mas pfx não, gerar apenas o pfx
  if [[ -f "$cert_file" ]] && [[ -f "$key_file" ]] && [[ ! -f "$pfx_file" ]]; then
    echo "Gerando apenas arquivo PFX a partir do certificado existente..."
    openssl pkcs12 -export -out "$pfx_file" -inkey "$key_file" -in "$cert_file" -passout pass: 2>/dev/null
    if [[ -f "$pfx_file" ]]; then
      chmod 600 "$pfx_file"
      echo "Arquivo PFX gerado: $pfx_file"
    fi
    return
  fi
  
  # Se todos existem, pular
  if [[ -f "$cert_file" ]] && [[ -f "$key_file" ]] && [[ -f "$pfx_file" ]]; then
    echo "Certificado M365 já existe, pulando geração..."
    return
  fi
  
  # ... resto da geração completa ...
}
```

---

## Detalhes Técnicos

### Conteúdo do `write_check_deps_script()`

O script será escrito em `/opt/iscope-agent/check-deps.sh` com as seguintes seções:
1. Flag file check (`/var/lib/iscope-agent/check_components.flag`)
2. OS detection
3. PowerShell installation (apt/dnf/yum)
4. M365 modules installation (ExchangeOnlineManagement, Microsoft.Graph.Authentication)
5. Certificate generation (com PFX)

### Localização no fluxo de instalação

```
main() {
  ...
  ensure_dirs
  generate_m365_certificate
  download_release
  setup_venv
  write_env_file
  ensure_state_file
  write_check_deps_script    # ADICIONAR AQUI
  write_systemd_service
  start_service
}
```

---

## Arquivos Modificados

| Arquivo | Ação |
|---------|------|
| `supabase/functions/agent-install/index.ts` | Adicionar `write_check_deps_script()` e corrigir `generate_m365_certificate()` |

---

## Impacto

- **Novas instalações:** Terão o `check-deps.sh` instalado e o `.pfx` gerado desde o início
- **Updates (`--update`):** Gerará o `check-deps.sh` e o `.pfx` faltante sem recriar o certificado
- **Flag manual:** Funcionará corretamente pois o `check-deps.sh` existirá

---

## Teste Após Deploy

```bash
# Atualizar instalação
curl -fsSL https://akbosdbyheezghieiefz.supabase.co/functions/v1/agent-install | sudo bash -s -- --update

# Verificar check-deps.sh foi criado
ls -la /opt/iscope-agent/check-deps.sh

# Verificar PFX foi criado
ls -la /var/lib/iscope-agent/certs/
# Esperado: m365.crt, m365.key, m365.pfx, thumbprint.txt

# Testar flag manual (opcional)
sudo touch /var/lib/iscope-agent/check_components.flag && sudo systemctl restart iscope-agent
tail -f /var/log/iscope-agent/components.log
```

