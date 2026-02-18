
# Frequência — Horário como badge inline

## Objetivo

Remover o texto `"às XX:00 UTC"` exibido abaixo do badge e substituir por um segundo badge compacto na **mesma linha** que o badge de frequência. Os badges ficam lado a lado em `flex-row gap-1`.

## Alteração

Arquivo: `src/pages/external-domain/ExternalDomainReportsPage.tsx`

### Linhas 705–728 — Célula de Frequência

Mudar o container de `flex flex-col gap-1` para `flex flex-row flex-wrap items-center gap-1` e trocar os `<span>` por badges secundários.

**Antes:**
```tsx
<div className="flex flex-col gap-1">
  <Badge variant="outline" className={...}>{label}</Badge>
  {daily && <span className="text-xs ...">às 20:00 UTC</span>}
  {weekly && <span className="text-xs ...">Segunda-feira às 20:00 UTC</span>}
  {monthly && <span className="text-xs ...">Dia 15 às 20:00 UTC</span>}
</div>
```

**Depois:**
```tsx
<div className="flex flex-row flex-wrap items-center gap-1">
  {/* Badge principal: Diário / Semanal / Mensal / Manual */}
  <Badge variant="outline" className={...}>{label}</Badge>

  {/* Badge secundário com o detalhe — sem "às" nem "UTC" */}
  {daily   && <Badge variant="outline" className="bg-muted text-muted-foreground border-border text-xs">20:00</Badge>}
  {weekly  && <Badge variant="outline" className="bg-muted text-muted-foreground border-border text-xs">Segunda · 20:00</Badge>}
  {monthly && <Badge variant="outline" className="bg-muted text-muted-foreground border-border text-xs">Dia 15 · 20:00</Badge>}
</div>
```

### Detalhes dos badges secundários

| Frequência | Conteúdo do badge secundário |
|---|---|
| Diário | `HH:mm` ex: `02:00` |
| Semanal | `NomeDia · HH:mm` ex: `Segunda · 14:00` |
| Mensal | `Dia N · HH:mm` ex: `Dia 15 · 08:00` |
| Manual | nenhum badge secundário |

O separador `·` (interponto) é mais compacto que " às " e adequado para badges curtos.

## Arquivo modificado

- `src/pages/external-domain/ExternalDomainReportsPage.tsx`
