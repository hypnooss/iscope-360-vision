

# Plano: Atualizar arquivo `latest` ao publicar nova versão

## Problema Identificado

Ao publicar uma nova versão do agent em **Configurações > Agents**, o código atual:

1. Faz upload apenas de `iscope-agent-{version}.tar.gz`
2. **NÃO** atualiza o arquivo `iscope-agent-latest.tar.gz`

Como o script de instalação usa `latest` por padrão, os novos agents instalados pegam uma versão desatualizada (ou o arquivo nem existe).

---

## Solução

Modificar a função `handlePublishUpdate` em `SettingsPage.tsx` para fazer **dois uploads**:
1. `iscope-agent-{version}.tar.gz` (arquivo versionado)
2. `iscope-agent-latest.tar.gz` (cópia para instalações padrão)

---

## Alteração

### Arquivo: `src/pages/admin/SettingsPage.tsx`

**Código atual (linhas 254-264):**
```typescript
// 1. Upload to Supabase Storage
const filename = `iscope-agent-${newVersion}.tar.gz`;
const { error: uploadError } = await supabase.storage
  .from('agent-releases')
  .upload(filename, selectedFile, {
    upsert: true,
    contentType: 'application/gzip'
  });

if (uploadError) throw uploadError;
```

**Código corrigido:**
```typescript
// 1. Upload versioned file to Supabase Storage
const versionedFilename = `iscope-agent-${newVersion}.tar.gz`;
const { error: uploadError } = await supabase.storage
  .from('agent-releases')
  .upload(versionedFilename, selectedFile, {
    upsert: true,
    contentType: 'application/gzip'
  });

if (uploadError) throw uploadError;

// 2. Also upload as 'latest' for default installations
const { error: latestUploadError } = await supabase.storage
  .from('agent-releases')
  .upload('iscope-agent-latest.tar.gz', selectedFile, {
    upsert: true,
    contentType: 'application/gzip'
  });

if (latestUploadError) {
  console.error('Error uploading latest:', latestUploadError);
  toast.warning('Versão publicada, mas erro ao atualizar arquivo latest');
}
```

---

## Resumo

| Arquivo | Ação |
|---------|------|
| `src/pages/admin/SettingsPage.tsx` | Adicionar upload do arquivo `latest` junto com o versionado |

---

## Resultado Esperado

Após a correção:
1. Ao publicar versão `1.1.0`, serão criados dois arquivos:
   - `iscope-agent-1.1.0.tar.gz`
   - `iscope-agent-latest.tar.gz` (cópia do 1.1.0)
2. Novas instalações com o script padrão baixarão sempre a versão mais recente
3. Instalações com `--version X.X.X` continuam funcionando normalmente

---

## Seção Técnica

### Fluxo de Upload

```
Usuário seleciona arquivo
       ↓
Calcula SHA256 checksum
       ↓
Clica "Publicar"
       ↓
Upload 1: iscope-agent-{version}.tar.gz
       ↓
Upload 2: iscope-agent-latest.tar.gz  ← NOVO
       ↓
Atualiza system_settings (version, checksum, force_update)
```

### Por que dois uploads?

O Supabase Storage não suporta "aliases" ou "symlinks" para arquivos. A única forma de manter um arquivo `latest` é fazer upload duas vezes do mesmo conteúdo.

