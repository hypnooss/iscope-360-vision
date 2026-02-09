

# Corrigir Geração PFX para Compatibilidade com OpenSSL 3.x

## Problema

O servidor do agente NEXTA usa **Oracle Linux 9** com **OpenSSL 3.x**, que gera arquivos PFX com algoritmos de criptografia modernos (AES-256-CBC) por padrão. O PowerShell/.NET nao consegue ler esses PFX, causando o erro:

```
Split-Path: Cannot bind argument to parameter 'Path' because it is an empty string
```

O erro ocorre internamente no modulo ExchangeOnlineManagement ao tentar carregar o certificado PFX - o .NET falha silenciosamente na leitura e passa um path vazio para `Split-Path`.

## Solucao

Adicionar a flag `-legacy` ao comando `openssl pkcs12 -export` em todos os locais que geram PFX. Isso forca o uso dos algoritmos classicos (PBE-SHA1-3DES) compativeis com .NET/PowerShell.

Como a flag `-legacy` pode nao existir em versoes mais antigas do OpenSSL (1.x), adicionar um fallback: tentar com `-legacy` primeiro, se falhar, tentar sem.

## Arquivos a Modificar

| Arquivo | Locais | Descricao |
|---------|--------|-----------|
| `python-agent/check-deps.sh` | Linha 310 | Geracao completa do certificado |
| `supabase/functions/agent-install/index.ts` | Linhas 347, 413, 983, 1033 | 4 trechos de geracao PFX no script de instalacao |

## Detalhe Tecnico

Substituir cada ocorrencia de:
```bash
openssl pkcs12 \
    -export \
    -out "$CERT_DIR/m365.pfx" \
    -inkey "$CERT_DIR/m365.key" \
    -in "$CERT_DIR/m365.crt" \
    -passout pass:
```

Por um padrao com fallback:
```bash
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
    -passout pass:
```

Isso garante compatibilidade tanto com OpenSSL 1.x (sem `-legacy`) quanto com OpenSSL 3.x (com `-legacy`).

## Apos a Correcao

No servidor do agente, executar:
```bash
sudo rm -f /var/lib/iscope-agent/certs/m365.pfx
sudo touch /var/lib/iscope-agent/check_components.flag
sudo systemctl restart iscope-agent
```

E entao disparar nova analise no tenant NEXTA.

