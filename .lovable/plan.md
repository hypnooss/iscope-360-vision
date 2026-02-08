
# Plano: Corrigir Geração do PFX na Instalação do Agent

## Problema Identificado

A função `generate_m365_certificate()` no script de instalação (`agent-install`) gera apenas os arquivos `.crt`, `.key` e `thumbprint.txt`, mas **não gera o arquivo `.pfx`** necessário para autenticação PowerShell.

O arquivo `.pfx` só é gerado pelo `check-deps.sh`, mas esse script só executa quando existe um arquivo de flag específico — que não existe na primeira instalação.

### Arquivos Envolvidos

| Arquivo | Gera .pfx? | Quando executa |
|---------|-----------|----------------|
| `agent-install` → `generate_m365_certificate()` | ❌ Não | Instalação/Update |
| `check-deps.sh` → `generate_certificate()` | ✅ Sim | Apenas com flag |

---

## Solução

### Modificação no script de instalação

Adicionar a geração do arquivo `.pfx` na função `generate_m365_certificate()` dentro do arquivo `supabase/functions/agent-install/index.ts`.

### Código a adicionar (após gerar o `.crt` e antes de calcular o thumbprint)

```bash
# Gerar arquivo PFX (PKCS#12) para compatibilidade com PowerShell
openssl pkcs12 \\
  -export \\
  -out "$key_file" \\          # será corrigido para $pfx_file
  -inkey "$key_file" \\
  -in "$cert_file" \\
  -passout pass: 2>/dev/null

if [[ -f "$pfx_file" ]]; then
  chmod 600 "$pfx_file"
  echo "  Arquivo PFX: $pfx_file"
fi
```

---

## Detalhes Técnicos

### Alteração específica na função `generate_m365_certificate()`

**Antes (linhas ~319-389):**
- Define `cert_dir`, `cert_file`, `key_file`, `thumbprint_file`
- Gera certificado com openssl
- Define permissões em `.key` e `.crt`
- Calcula e salva thumbprint

**Depois:**
- Adicionar variável `pfx_file="$cert_dir/m365.pfx"`
- Adicionar bloco de geração do PFX após o certificado ser criado
- Incluir o caminho do PFX na mensagem de sucesso

### Código completo da correção

```bash
generate_m365_certificate() {
  local cert_dir="$STATE_DIR/certs"
  local cert_file="$cert_dir/m365.crt"
  local key_file="$cert_dir/m365.key"
  local pfx_file="$cert_dir/m365.pfx"           # ADICIONAR
  local thumbprint_file="$cert_dir/thumbprint.txt"
  
  # ... verificação existência (atualizar para incluir pfx) ...
  if [[ -f "$cert_file" ]] && [[ -f "$key_file" ]] && [[ -f "$pfx_file" ]]; then
    echo "Certificado M365 já existe, pulando geração..."
    return
  fi
  
  # ... geração do certificado .crt e .key ...
  
  # ADICIONAR: Gerar arquivo PFX para PowerShell
  openssl pkcs12 \\
    -export \\
    -out "$pfx_file" \\
    -inkey "$key_file" \\
    -in "$cert_file" \\
    -passout pass: 2>/dev/null
  
  if [[ -f "$pfx_file" ]]; then
    chmod 600 "$pfx_file"
  else
    echo "Aviso: Falha ao gerar arquivo PFX."
  fi
  
  # ... resto da função (thumbprint, permissões) ...
}
```

---

## Arquivos Modificados

| Arquivo | Ação |
|---------|------|
| `supabase/functions/agent-install/index.ts` | Adicionar geração do `.pfx` |

---

## Impacto

- **Novas instalações:** Terão o `.pfx` desde o início
- **Updates:** Ao rodar `--update`, a função regerá os certificados incluindo o `.pfx`
- **Instalações existentes:** Continuam precisando do `check_components.flag` para regenerar

---

## Verificação Pós-Deploy

Após implementar e deployar a edge function:

```bash
# Em um novo servidor OU com --update:
curl -fsSL https://akbosdbyheezghieiefz.supabase.co/functions/v1/agent-install | sudo bash -s -- --update

# Verificar que o PFX foi criado:
ls -la /var/lib/iscope-agent/certs/
# Deve mostrar: m365.crt, m365.key, m365.pfx, thumbprint.txt
```
