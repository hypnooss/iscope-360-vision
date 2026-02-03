

# Plano: Corrigir Instalação do Amass no Script agent-install

## Problema Identificado

O log mostra:
```
Amass instalado: main: line 221: amass: command not found
```

**Causas:**

1. **PATH não inclui `/usr/local/bin`** durante a execução do subshell `$(amass -version)`
2. **Estrutura do ZIP mudou**: O Amass v4.2.0 organiza os arquivos de forma diferente - o binário pode não ser encontrado pelo `find`

## Solução

Corrigir a função `install_amass()` para:
1. Usar caminho absoluto ao verificar a instalação
2. Adicionar `/usr/local/bin` ao PATH
3. Melhorar a busca do binário no pacote extraído

---

## Alterações

### Arquivo: `supabase/functions/agent-install/index.ts`

#### Mudanças na função `install_amass()`

**De:**
```bash
# O zip contém uma pasta amass_Linux_xxx/amass
local bin_path
bin_path="$(find "$tmp_dir" -name 'amass' -type f -executable | head -1)"

if [[ -n "$bin_path" ]]; then
  mv "$bin_path" /usr/local/bin/amass
  chmod +x /usr/local/bin/amass
  echo "Amass instalado: $(amass -version 2>&1 | head -1)"
else
  echo "Aviso: binário do Amass não encontrado no pacote."
fi
```

**Para:**
```bash
# Adicionar /usr/local/bin ao PATH para este script
export PATH="/usr/local/bin:\$PATH"

# O zip extrai para uma pasta amass_Linux_xxx/ contendo o binário
local bin_path
bin_path="\$(find "\$tmp_dir" -name 'amass' -type f 2>/dev/null | head -1)"

if [[ -z "\$bin_path" ]]; then
  # Tentar buscar em subpastas específicas
  bin_path="\$(find "\$tmp_dir" -path '*/amass_Linux_*/amass' -type f 2>/dev/null | head -1)"
fi

if [[ -n "\$bin_path" ]]; then
  mv "\$bin_path" /usr/local/bin/amass
  chmod +x /usr/local/bin/amass
  
  # Verificar usando caminho absoluto
  if /usr/local/bin/amass -version >/dev/null 2>&1; then
    echo "Amass instalado: \$(/usr/local/bin/amass -version 2>&1 | head -1)"
  else
    echo "Amass instalado em /usr/local/bin/amass"
  fi
else
  echo "Aviso: binário do Amass não encontrado no pacote."
  echo "Estrutura encontrada:"
  find "\$tmp_dir" -type f | head -10
fi
```

---

## Mudanças Específicas

| Linha | Mudança |
|-------|---------|
| 189 | Adicionar `export PATH="/usr/local/bin:\$PATH"` no início da função |
| 232 | Remover `-executable` do find (não funciona em todos os sistemas) |
| 232-233 | Adicionar fallback para busca alternativa |
| 237 | Usar caminho absoluto `/usr/local/bin/amass -version` |
| 239-241 | Adicionar debug de estrutura caso binário não seja encontrado |

---

## Código Completo da Função Corrigida

```bash
install_amass() {
  echo "Instalando Amass para enumeração de subdomínios..."
  
  # Garantir que /usr/local/bin está no PATH
  export PATH="/usr/local/bin:\$PATH"
  
  local arch
  arch="\$(uname -m)"
  case "\$arch" in
    x86_64)  arch="amd64" ;;
    aarch64) arch="arm64" ;;
    *)
      echo "Aviso: arquitetura \$arch não suportada para Amass. Pulando instalação."
      return 0
      ;;
  esac
  
  local version="v4.2.0"
  local filename="amass_Linux_\${arch}.zip"
  local url="https://github.com/owasp-amass/amass/releases/download/\${version}/\${filename}"
  local tmp_dir
  tmp_dir="\$(mktemp -d)"
  
  echo "Baixando Amass \${version} (\${arch})..."
  
  if ! curl -fsSL "\$url" -o "\${tmp_dir}/amass.zip"; then
    echo "Aviso: falha ao baixar Amass. Continuando sem ele."
    rm -rf "\$tmp_dir"
    return 0
  fi
  
  # Instalar unzip se necessário
  if ! command -v unzip >/dev/null 2>&1; then
    if command -v apt-get >/dev/null 2>&1; then
      apt-get install -y unzip || true
    elif command -v dnf >/dev/null 2>&1; then
      dnf install -y unzip || true
    elif command -v yum >/dev/null 2>&1; then
      yum install -y unzip || true
    fi
  fi
  
  unzip -q "\${tmp_dir}/amass.zip" -d "\$tmp_dir"
  
  # Buscar binário - primeiro sem -executable (compatibilidade)
  local bin_path
  bin_path="\$(find "\$tmp_dir" -name 'amass' -type f 2>/dev/null | head -1)"
  
  # Fallback: buscar em estrutura conhecida
  if [[ -z "\$bin_path" ]]; then
    bin_path="\$(find "\$tmp_dir" -path '*/amass_Linux_*/amass' -type f 2>/dev/null | head -1)"
  fi
  
  if [[ -n "\$bin_path" ]]; then
    mv "\$bin_path" /usr/local/bin/amass
    chmod +x /usr/local/bin/amass
    
    # Verificar usando caminho absoluto
    if /usr/local/bin/amass -version >/dev/null 2>&1; then
      echo "Amass instalado: \$(/usr/local/bin/amass -version 2>&1 | head -1)"
    else
      echo "Amass instalado em /usr/local/bin/amass"
    fi
  else
    echo "Aviso: binário do Amass não encontrado no pacote."
    echo "Arquivos encontrados:"
    find "\$tmp_dir" -type f 2>/dev/null | head -10
  fi
  
  rm -rf "\$tmp_dir"
}
```

---

## Resumo

| Arquivo | Ação |
|---------|------|
| `supabase/functions/agent-install/index.ts` | Corrigir função `install_amass()` |

---

## Resultado Esperado

Após a correção:
1. O binário do Amass será encontrado corretamente no pacote ZIP
2. A verificação de versão usará caminho absoluto
3. Em caso de erro, haverá debug útil para diagnosticar o problema
4. O script continuará funcionando mesmo se o Amass não puder ser instalado

