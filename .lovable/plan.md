

# Plano: Adicionar Suporte a "all versions" na Extração de CVEs

## Problema Identificado

A CVE-2025-31514 menciona:
```
FortiOS 7.4 all versions → Migrate to a fixed release
```

O regex atual na função `extractFortiOSInfo()` não captura esse padrão:

```typescript
// Linha 35 - Só captura versões específicas com range
const fortiOSPattern = /FortiOS\s+(?:version\s+)?(\d+\.\d+(?:\.\d+)?)\s*(?:through|to|before|and later|and earlier|-)\s*(\d+\.\d+(?:\.\d+)?)/gi;
```

**Resultado**: CVEs que afetam "all versions" ficam sem a informação de versões afetadas exibida corretamente.

---

## Arquivo a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/fortigate-cve/index.ts` | Adicionar regex para capturar padrão "all versions" |

---

## Alteração Técnica

### Adicionar Novo Padrão Regex (após linha 36)

```typescript
// Padrões comuns de versão FortiOS na descrição
const fortiOSPattern = /FortiOS\s+(?:version\s+)?(\d+\.\d+(?:\.\d+)?)\s*(?:through|to|before|and later|and earlier|-)\s*(\d+\.\d+(?:\.\d+)?)/gi;
const fortiOSSinglePattern = /FortiOS\s+(?:version\s+)?(\d+\.\d+(?:\.\d+)?(?:\s*,?\s*\d+\.\d+(?:\.\d+)?)*)/gi;

// NOVO: Padrão para "all versions"
const fortiOSAllVersionsPattern = /FortiOS\s+(?:version\s+)?(\d+\.\d+(?:\.\d+)?)\s+all\s+versions/gi;
```

### Modificar Lógica de Extração (linhas 38-48)

```typescript
// Encontrar versões FortiOS afetadas
let affectedVersions = '';

// Primeiro: verificar padrão "all versions"
const allVersionsMatches = fullDescription.match(fortiOSAllVersionsPattern);
if (allVersionsMatches && allVersionsMatches.length > 0) {
  affectedVersions = allVersionsMatches.join(', ');
}

// Segundo: verificar range de versões (through/to/before)
if (!affectedVersions) {
  const matches = fullDescription.match(fortiOSPattern);
  if (matches && matches.length > 0) {
    affectedVersions = matches.join(', ');
  }
}

// Terceiro: verificar versão única
if (!affectedVersions) {
  const singleMatches = fullDescription.match(fortiOSSinglePattern);
  if (singleMatches) {
    affectedVersions = singleMatches.join(', ');
  }
}
```

---

## Padrões Capturados Após Correção

| Padrão na Descrição | Resultado |
|---------------------|-----------|
| `FortiOS 7.4.0 through 7.4.10` | `FortiOS 7.4.0 through 7.4.10` ✅ |
| `FortiOS 7.4 all versions` | `FortiOS 7.4 all versions` ✅ **NOVO** |
| `FortiOS version 7.2 all versions` | `FortiOS version 7.2 all versions` ✅ **NOVO** |
| `FortiOS 7.6.0 before 7.6.4` | `FortiOS 7.6.0 before 7.6.4` ✅ |

---

## Resultado Esperado na UI

### CVE-2025-31514

**Antes**:
```
CVE-2025-31514 | HIGH (7.1)
(sem versões afetadas mostradas)
"An Insertion of Sensitive Information into Log File vulnerability..."
```

**Depois**:
```
CVE-2025-31514 | HIGH (7.1)
Versões FortiOS afetadas: FortiOS 7.4 all versions
"FortiOS 7.4 all versions - allows an attacker with at least read-only privileges to retrieve sensitive 2FA-related information..."
```

---

## Código Completo da Função Atualizada

```typescript
function extractFortiOSInfo(fullDescription: string): {
  fortiOSDescription: string;
  affectedVersions: string;
  technicalDescription: string;
} {
  const descLower = fullDescription.toLowerCase();
  
  // Se não menciona FortiOS, retornar descrição original
  if (!descLower.includes('fortios')) {
    return {
      fortiOSDescription: fullDescription,
      affectedVersions: '',
      technicalDescription: fullDescription
    };
  }
  
  // Padrões comuns de versão FortiOS na descrição
  const fortiOSPattern = /FortiOS\s+(?:version\s+)?(\d+\.\d+(?:\.\d+)?)\s*(?:through|to|before|and later|and earlier|-)\s*(\d+\.\d+(?:\.\d+)?)/gi;
  const fortiOSSinglePattern = /FortiOS\s+(?:version\s+)?(\d+\.\d+(?:\.\d+)?(?:\s*,?\s*\d+\.\d+(?:\.\d+)?)*)/gi;
  // NOVO: Padrão para "all versions"
  const fortiOSAllVersionsPattern = /FortiOS\s+(?:version\s+)?(\d+\.\d+(?:\.\d+)?)\s+all\s+versions/gi;
  
  // Encontrar versões FortiOS afetadas
  let affectedVersions = '';
  
  // Primeiro: verificar padrão "all versions"
  const allVersionsMatches = fullDescription.match(fortiOSAllVersionsPattern);
  if (allVersionsMatches && allVersionsMatches.length > 0) {
    affectedVersions = allVersionsMatches.join(', ');
  }
  
  // Segundo: verificar range de versões (through/to/before)
  if (!affectedVersions) {
    const matches = fullDescription.match(fortiOSPattern);
    if (matches && matches.length > 0) {
      affectedVersions = matches.join(', ');
    }
  }
  
  // Terceiro: verificar versão única
  if (!affectedVersions) {
    const singleMatches = fullDescription.match(fortiOSSinglePattern);
    if (singleMatches) {
      affectedVersions = singleMatches.join(', ');
    }
  }
  
  // Extrair a parte técnica da descrição
  const technicalPatterns = [
    /\b(allows?\s+.+)/i,
    /\b(may\s+allow\s+.+)/i,
    /\b(enables?\s+.+)/i,
    /\b(could\s+allow\s+.+)/i,
    /\b(permits?\s+.+)/i,
    /\b(makes?\s+it\s+possible\s+.+)/i,
  ];
  
  let technicalDescription = '';
  for (const pattern of technicalPatterns) {
    const techMatch = fullDescription.match(pattern);
    if (techMatch) {
      technicalDescription = techMatch[1];
      break;
    }
  }
  
  // Construir descrição focada no FortiOS
  let fortiOSDescription = '';
  if (affectedVersions) {
    fortiOSDescription = affectedVersions;
    if (technicalDescription) {
      fortiOSDescription += ' - ' + technicalDescription;
    }
  } else {
    const sentences = fullDescription.split(/[.;]/);
    for (const sentence of sentences) {
      if (sentence.toLowerCase().includes('fortios')) {
        fortiOSDescription = sentence.trim();
        break;
      }
    }
    if (!fortiOSDescription) {
      fortiOSDescription = fullDescription;
    }
  }
  
  return {
    fortiOSDescription: fortiOSDescription.substring(0, 400) + (fortiOSDescription.length > 400 ? '...' : ''),
    affectedVersions,
    technicalDescription: technicalDescription || fullDescription
  };
}
```

