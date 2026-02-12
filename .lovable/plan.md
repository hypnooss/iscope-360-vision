

# Melhorar Mapa de Ataques e Visual dos Top IPs de Autenticacao

## Problemas Identificados

1. **Mapa**: O SVG atual usa paths simplificados de continentes que nao parecem um mapa real - sao formas abstratas sem definicao geografica
2. **Top IPs - Autenticacao**: O layout da lista esta desorganizado - nome do pais e bandeira aparecem em formato estranho com parenteses e quebras de linha

## Mudancas

### 1. Componente `AttackMap.tsx` - Mapa mundial realista

Substituir os paths SVG simplificados por um mapa do mundo detalhado usando GeoJSON natural earth simplificado. O SVG tera paths reais dos continentes/paises com:

- Contornos de paises em estilo dark (preenchimento escuro, bordas sutis)
- Projecao equiretangular mantida (simples e funcional)
- Os pontos de ataque continuam com as mesmas cores e animacoes pulse
- Fundo escuro com grid sutil para efeito "cyber"
- Usar um SVG world map inline com paths reais (existe um SVG simplificado de ~15KB que cobre todos os paises principais)

### 2. Widget `IPListWidget` no `AnalyzerDashboardPage.tsx` - Melhorar visual

Problemas atuais vistos no screenshot:
- O pais aparece como `( bandeira NomePais )` com parenteses e quebra de linha
- Layout desalinhado

Correcoes:
- Remover os parenteses ao redor do pais
- Colocar IP e pais na mesma linha, com layout limpo: `IP  [bandeira] Pais` a esquerda, contagem a direita
- Adicionar barra de progresso visual proporcional ao maior valor para dar contexto visual
- Numerar com badge ao inves de texto simples
- Melhorar espacamento e tipografia

Layout proposto para cada linha:
```text
[#1]  192.168.1.1    [bandeira] Netherlands    ████████░░  8
```

### Arquivos a editar

- `src/components/firewall/AttackMap.tsx` - Substituir WORLD_PATH por paths reais de continentes
- `src/pages/firewall/AnalyzerDashboardPage.tsx` - Refatorar `IPListWidget` para visual limpo e profissional

## Secao tecnica

### AttackMap - SVG paths reais

Usar um conjunto de paths SVG de continentes simplificados (Africa, Americas, Europa, Asia, Oceania) que formam um mapa mundial reconhecivel. Os paths serao definidos com viewBox `0 0 1000 500` e projecao natural. Cada continente tera preenchimento `hsl(var(--muted))` com opacidade baixa e borda sutil, criando um visual escuro e profissional.

### IPListWidget - Novo layout

```text
function IPListWidget({ ips }) {
  const maxCount = Math.max(...ips.map(ip => ip.count));
  return ips.map((ip, i) => (
    <div className="flex items-center gap-3">
      <span className="w-6 text-center font-mono text-xs text-muted-foreground">{i+1}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm font-medium">{ip.ip}</span>
          {ip.country && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <flag /> {ip.country}
            </span>
          )}
        </div>
        // Barra de progresso proporcional
        <div className="h-1 bg-secondary rounded mt-1">
          <div style={{ width: `${(ip.count/maxCount)*100}%` }} className="h-1 bg-primary/60 rounded" />
        </div>
      </div>
      <Badge>{ip.count}</Badge>
    </div>
  ));
}
```

### Arquivos a editar
- `src/components/firewall/AttackMap.tsx`
- `src/pages/firewall/AnalyzerDashboardPage.tsx`

