# ✅ CONCLUÍDO: Corrigir Geração do PFX na Instalação do Agent

## Problema Resolvido

A função `generate_m365_certificate()` no script de instalação (`agent-install`) agora gera o arquivo `.pfx` junto com os arquivos `.crt`, `.key` e `thumbprint.txt`.

## Alterações Realizadas

- Adicionada variável `pfx_file="$cert_dir/m365.pfx"`
- Atualizada verificação de existência para incluir `.pfx`
- Adicionado bloco de geração do PFX após criar o certificado
- Atualizada mensagem de sucesso para incluir caminho do PFX

## Verificação Pós-Deploy

```bash
# Em um novo servidor OU com --update:
curl -fsSL https://akbosdbyheezghieiefz.supabase.co/functions/v1/agent-install | sudo bash -s -- --update

# Verificar que o PFX foi criado:
ls -la /var/lib/iscope-agent/certs/
# Deve mostrar: m365.crt, m365.key, m365.pfx, thumbprint.txt
```
