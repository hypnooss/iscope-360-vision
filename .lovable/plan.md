

# Fix: Instalacao do masscan no Oracle Linux 9

## Problema

No Oracle Linux 9 (aarch64):
1. `masscan` nao existe nos repositorios padrao (nem no EPEL)
2. O fallback de compilacao falhou porque `git` e `libpcap-devel` nao foram instalados antes da tentativa

## Causa Raiz

Na funcao `install_masscan_from_source()`, o comando `dnf install -y git make gcc libpcap-devel` falha silenciosamente com `|| true`. Como `git` nao foi instalado, o script para imediatamente com "git nao disponivel".

O `libpcap-devel` no Oracle Linux 9 precisa do repositorio `ol9_developer_EPEL` ou `ol9_codeready_builder` habilitado. O `git` precisa do `ol9_appstream`.

## Correcao

Arquivo: `supabase/functions/super-agent-install/index.ts`

### 1. Melhorar `install_masscan_from_source()` (linhas 253-285)

- Instalar `git` separadamente antes de `libpcap-devel` para garantir que cada falha seja tratada
- Habilitar repositorios adicionais do Oracle Linux (CodeReady Builder / CRB) que contem `libpcap-devel`
- Usar `dnf install --enablerepo=*` como fallback para encontrar pacotes em repos desabilitados
- Tentar baixar release binario do masscan como alternativa antes da compilacao

### 2. Adicionar fallback de download binario

Antes de compilar do fonte, tentar baixar um binario pre-compilado do masscan (similar ao httpx):
- URL: `https://github.com/robertdavidgraham/masscan/releases`
- Se nao houver binario disponivel para a arquitetura, prosseguir com compilacao

### 3. Melhorar instalacao de dependencias de compilacao no RHEL/OL

```text
# Habilitar CRB (Code Ready Builder) - necessario para libpcap-devel
dnf config-manager --set-enabled crb 2>/dev/null || true
dnf config-manager --set-enabled ol9_codeready_builder 2>/dev/null || true

# Instalar git primeiro (appstream)
dnf install -y git || true

# Instalar dependencias de compilacao
dnf install -y make gcc libpcap-devel || true
```

### 4. Resumo das alteracoes

- Habilitar repositorios CRB/CodeReady antes de instalar `libpcap-devel`
- Instalar `git` explicitamente via appstream
- Manter o fluxo: pacote -> binario -> compilacao
- Adicionar log mais claro sobre qual etapa falhou

