

# Plano: Filtrar Exibição de CVEs para Mostrar Apenas Informações do FortiOS

## Problema Identificado

A busca na NVD retorna CVEs que podem afetar **múltiplos produtos Fortinet**. A descrição do CVE contém todos os produtos:

```
"A vulnerability in FortiOS 7.4.0 through 7.4.10, FortiAnalyzer 7.4.0 through 7.4.5, 
FortiManager 7.4.0 through 7.4.3..."
```

Atualmente, a UI exibe a descrição **completa**, o que confunde porque mostra produtos irrelevantes para a análise de firewall.

---

## Solução

Processar a descrição do CVE para:

1. **Extrair apenas a parte relacionada ao FortiOS**
2. **Mostrar apenas versões do FortiOS afetadas**
3. **Manter a descrição técnica do problema**

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/fortigate-cve/index.ts` | Processar descrição para extrair apenas info do FortiOS |
| `src/types/compliance.ts` | Adicionar campo `fortiOSVersions` ao CVEInfo (opcional) |

---

## Alterações Técnicas

### 1. Adicionar Função para Extrair Info FortiOS da Descrição

```typescript
// Extrai apenas a parte da descrição relacionada ao FortiOS
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
  // Ex: "FortiOS 7.4.0 through 7.4.10"
  // Ex: "FortiOS version 7.4.0 to 7.4.10"
  // Ex: "FortiOS 7.4.x before 7.4.10"
  const fortiOSPattern = /FortiOS\s+(?:version\s+)?(\d+\.\d+(?:\.\d+)?)\s*(?:through|to|before|and later|and earlier|-)\s*(\d+\.\d+(?:\.\d+)?)/gi;
  const fortiOSSinglePattern = /FortiOS\s+(?:version\s+)?(\d+\.\d+(?:\.\d+)?(?:\s*,?\s*\d+\.\d+(?:\.\d+)?)*)/gi;
  
  // Encontrar versões FortiOS afetadas
  let affectedVersions = '';
  const matches = fullDescription.match(fortiOSPattern);
  if (matches && matches.length > 0) {
    affectedVersions = matches.join(', ');
  } else {
    const singleMatches = fullDescription.match(fortiOSSinglePattern);
    if (singleMatches) {
      affectedVersions = singleMatches.join(', ');
    }
  }
  
  // Extrair a parte técnica da descrição (após listar produtos)
  // Geralmente começa com "allows", "may allow", "enables", etc.
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
    // Fallback: pegar a primeira frase que menciona FortiOS
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

### 2. Modificar Processamento dos CVEs

Na função que mapeia as vulnerabilidades, aplicar o filtro:

```typescript
cves = nvdData.vulnerabilities
  .filter((vuln: any) => {
    // Garantir que o CVE realmente afeta FortiOS
    const desc = vuln.cve.descriptions?.find((d: any) => d.lang === 'en')?.value || '';
    return desc.toLowerCase().includes('fortios');
  })
  .map((vuln: any) => {
    const cve = vuln.cve;
    
    // Obter descrição original
    const fullDescription = cve.descriptions?.find((d: any) => d.lang === 'en')?.value || 
                          cve.descriptions?.[0]?.value || 'No description available';
    
    // Extrair apenas informações do FortiOS
    const fortiOSInfo = extractFortiOSInfo(fullDescription);
    
    // ... resto do mapeamento ...
    
    return {
      id: cve.id,
      description: fortiOSInfo.fortiOSDescription,  // ← Usar descrição filtrada
      affectedVersions: fortiOSInfo.affectedVersions,  // ← NOVO campo
      severity,
      score,
      publishedDate: cve.published,
      lastModifiedDate: cve.lastModified,
      references,
    };
  });
```

### 3. Atualizar Interface CVEItem (opcional)

```typescript
interface CVEItem {
  id: string;
  description: string;
  affectedVersions?: string;  // NOVO: versões FortiOS afetadas
  severity: string;
  score: number;
  publishedDate: string;
  lastModifiedDate: string;
  references: string[];
}
```

### 4. Atualizar Componente CVESection (opcional)

Para exibir as versões afetadas de forma destacada:

```typescript
{cve.affectedVersions && (
  <div className="text-xs text-amber-400 mb-1">
    Versões afetadas: {cve.affectedVersions}
  </div>
)}
<p className="text-sm text-muted-foreground line-clamp-2">
  {cve.description}
</p>
```

---

## Resultado Esperado

### Antes:
```
CVE-2026-12345
"A vulnerability in FortiOS 7.4.0 through 7.4.10, FortiAnalyzer 7.4.0 through 7.4.5, 
FortiManager 7.4.0 through 7.4.3, FortiSwitchManager before 7.2.4 allows an 
authenticated attacker to execute arbitrary code..."
```

### Depois:
```
CVE-2026-12345
Versões afetadas: FortiOS 7.4.0 through 7.4.10
"FortiOS 7.4.0 through 7.4.10 - allows an authenticated attacker to execute 
arbitrary code..."
```

---

## Casos de Borda Tratados

1. **CVE sem menção ao FortiOS**: Filtrado da lista (não exibido)
2. **CVE com múltiplas versões FortiOS**: Todas extraídas e listadas
3. **Descrição técnica longa**: Truncada em 400 caracteres
4. **Formato de versão variado**: Regex cobre "through", "to", "before", "-"
5. **Descrição sem padrão claro**: Fallback para primeira frase com FortiOS

