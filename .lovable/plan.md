

## Simplificar Nó Central do Mapa DNS

### Alteração

Remover o texto do nome do domínio do nó central, mantendo apenas o ícone do globo como elemento visual de conexão.

### Mudança Técnica

**Arquivo:** `src/components/external-domain/DNSMapSection.tsx`

**Antes (linhas 351-362):**
```tsx
{/* Root Domain Node - with globe background */}
<div className="flex justify-center mb-4">
  <div className="relative">
    {/* Globe background */}
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      <Globe className="w-24 h-24 text-primary/10" />
    </div>
    {/* Domain name overlay - transparent border only to show globe */}
    <div className="relative px-8 py-4 rounded-xl border border-primary/30">
      <span className="text-lg font-bold text-foreground tracking-wide">{domain}</span>
    </div>
  </div>
</div>
```

**Depois:**
```tsx
{/* Root Domain Node - globe icon only */}
<div className="flex justify-center mb-4">
  <div className="p-4 rounded-full border border-primary/30 bg-primary/5">
    <Globe className="w-12 h-12 text-primary/40" />
  </div>
</div>
```

### Resultado Visual

O globo ficará centralizado, com um estilo mais clean - apenas o ícone circular com borda sutil, servindo como ponto de origem visual para as linhas de conexão às colunas NS, SOA e Subdomínios.

