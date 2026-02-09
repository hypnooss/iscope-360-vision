

# Corrigir Deteccao de Mudanca de Certificado e Regeneracao PFX

## Problema

Dois bugs independentes causam falha na autenticacao CBA apos regeneracao de certificado:

1. **check-deps.sh**: quando apenas o `.pfx` esta ausente (mas `.crt` e `.key` existem), o script regenera o certificado inteiro (nova chave, novo thumbprint). O novo thumbprint nunca e enviado ao Azure, quebrando a autenticacao.

2. **heartbeat (agent + backend)**: nenhum dos dois detecta mudanca de thumbprint. O agent nao reenvia o certificado se `azure_certificate_key_id` existe no state local. O backend ignora certificados recebidos se `azure_certificate_key_id` ja existe no banco.

## Solucao

### Arquivo 1: `python-agent/check-deps.sh`

Adicionar logica para diferenciar entre "PFX ausente" e "certificado ausente":

```text
check_certificate() -> true (todos existem)
  |
  v (false)
.crt e .key existem? --SIM--> Regenerar APENAS o PFX (sem tocar em key/crt/thumbprint)
  |
  NAO
  v
Regenerar tudo (key + crt + pfx + thumbprint)
```

Mudanca concreta na funcao `generate_certificate()`:
- Antes de regenerar tudo, verificar se `.crt` e `.key` existem
- Se sim, gerar apenas o `.pfx` a partir dos existentes e retornar
- Se nao, continuar com o fluxo completo de geracao

### Arquivo 2: `python-agent/agent/heartbeat.py`

No metodo `_get_pending_certificate()`, alem de checar se `azure_certificate_key_id` existe no state, comparar o thumbprint atual do disco com um thumbprint salvo no state:

- Salvar `registered_thumbprint` no state quando o certificado e registrado
- No proximo heartbeat, comparar o thumbprint do disco com `registered_thumbprint`
- Se forem diferentes, limpar `azure_certificate_key_id` e forcar reenvio

### Arquivo 3: `supabase/functions/agent-heartbeat/index.ts`

Na logica de processamento de certificado (linhas 583-596), quando o agent envia um certificado com thumbprint diferente do armazenado no banco:

- Comparar `sanitizedInputThumbprint` com `sanitizedAgentThumbprint` (ja disponivel na linha 581)
- Se forem diferentes, fazer upload do novo certificado mesmo que `azure_certificate_key_id` ja exista
- Logar a mudanca de thumbprint

## Detalhe Tecnico

### check-deps.sh - Funcao `generate_certificate()`

Inserir ANTES da linha "Gerando certificado M365..." (linha 264):

```bash
# If .crt and .key exist but .pfx is missing, only regenerate PFX
if [[ -f "$CERT_DIR/m365.crt" ]] && [[ -f "$CERT_DIR/m365.key" ]] && [[ ! -f "$CERT_DIR/m365.pfx" ]]; then
    log "Gerando apenas arquivo PFX a partir do certificado existente..."

    openssl pkcs12 \
        -export \
        -out "$CERT_DIR/m365.pfx" \
        -inkey "$CERT_DIR/m365.key" \
        -in "$CERT_DIR/m365.crt" \
        -passout pass: \
        -legacy 2>/dev/null || \
    openssl pkcs12 \
        -export \
        -out "$CERT_DIR/m365.pfx" \
        -inkey "$CERT_DIR/m365.key" \
        -in "$CERT_DIR/m365.crt" \
        -passout pass: 2>/dev/null

    if [[ -f "$CERT_DIR/m365.pfx" ]]; then
        chmod 600 "$CERT_DIR/m365.pfx"
        if id "$SERVICE_USER" >/dev/null 2>&1; then
            chown "$SERVICE_USER":"$SERVICE_USER" "$CERT_DIR/m365.pfx" || true
        fi
        log "Arquivo PFX gerado: $CERT_DIR/m365.pfx"
        return 0
    else
        log_error "Falha ao gerar arquivo PFX"
        return 1
    fi
fi
```

### heartbeat.py - Metodo `_get_pending_certificate()`

Adicionar deteccao de mudanca de thumbprint:

```python
def _get_pending_certificate(self, force=False):
    if not CERT_FILE.exists():
        return None

    thumbprint = get_certificate_thumbprint()
    public_key = get_certificate_public_key()

    if not thumbprint or not public_key:
        return None

    # Detect thumbprint change (certificate was regenerated)
    stored_thumbprint = self.state.data.get("registered_thumbprint")
    if stored_thumbprint and stored_thumbprint != thumbprint:
        self.logger.info(f"Thumbprint mudou: {stored_thumbprint[:8]}... -> {thumbprint[:8]}... Forcando reenvio.")
        # Clear azure flag so certificate gets re-uploaded
        if "azure_certificate_key_id" in self.state.data:
            del self.state.data["azure_certificate_key_id"]
            self.state.save()
        force = True

    # Certificate already registered in Azure (unless forced)
    if not force and self.state.data.get("azure_certificate_key_id"):
        return None

    self.logger.info(f"Certificado pendente detectado: {thumbprint[:8]}...")
    return {
        "certificate_thumbprint": thumbprint,
        "certificate_public_key": public_key
    }
```

E no metodo `send()`, salvar o thumbprint registrado:

```python
# Check if certificate was registered
if pending_cert and response.get("azure_certificate_key_id"):
    self.state.data["azure_certificate_key_id"] = response["azure_certificate_key_id"]
    self.state.data["registered_thumbprint"] = pending_cert["certificate_thumbprint"]
    self.state.save()
```

### agent-heartbeat/index.ts - Logica de certificado (linhas 583-596)

Substituir a logica atual por:

```typescript
if (body.certificate_public_key && sanitizedInputThumbprint) {
  // Check if thumbprint changed (certificate was regenerated)
  const thumbprintChanged = sanitizedAgentThumbprint &&
    sanitizedAgentThumbprint !== sanitizedInputThumbprint;

  if (thumbprintChanged) {
    console.log(`Agent ${agentId}: thumbprint changed ${sanitizedAgentThumbprint?.substring(0, 8)}... -> ${sanitizedInputThumbprint?.substring(0, 8)}..., re-uploading`);
  }

  if (!agentData?.azure_certificate_key_id || thumbprintChanged) {
    console.log(`Agent ${agentId} uploading certificate (thumbprint: ${sanitizedInputThumbprint?.substring(0, 8)}...)`);
    azureCertificateKeyId = await uploadAgentCertificate(
      supabase, agentId, sanitizedInputThumbprint, body.certificate_public_key
    );
  } else {
    azureCertificateKeyId = agentData.azure_certificate_key_id;
  }
}
```

## Resumo de Mudancas

| Arquivo | Mudanca |
|---------|---------|
| `python-agent/check-deps.sh` | Regenerar apenas PFX quando .crt/.key existem |
| `python-agent/agent/heartbeat.py` | Detectar mudanca de thumbprint e forcar reenvio |
| `supabase/functions/agent-heartbeat/index.ts` | Aceitar re-upload quando thumbprint muda |

## Pos-Correcao

No servidor do agente NEXTA, como o certificado ja foi regenerado (thumbprint novo no disco vs thumbprint antigo no Azure), basta:

1. Limpar o state para forcar reenvio:
```bash
# Editar /var/lib/iscope-agent/state.json e remover "azure_certificate_key_id" e "registered_thumbprint"
sudo python3 -c "
import json
state_file = '/var/lib/iscope-agent/state.json'
with open(state_file) as f:
    state = json.load(f)
state.pop('azure_certificate_key_id', None)
state.pop('registered_thumbprint', None)
with open(state_file, 'w') as f:
    json.dump(state, f, indent=2)
print('State limpo:', json.dumps(state, indent=2))
"
sudo systemctl restart iscope-agent
```

2. Aguardar o proximo heartbeat (60s) - o certificado sera reenviado automaticamente
3. Disparar nova analise no tenant NEXTA

