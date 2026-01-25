
# Validação de URL Base para Firewalls

## Objetivo

Adicionar validação frontend no campo `fortigate_url` para impedir que URLs com paths, query strings ou fragmentos sejam salvas. Isso evita o problema onde URLs malformadas como `https://10.11.0.250:444/login?redir=%2F` causam falhas na coleta de dados.

## Lógica de Validação

### URLs Válidas (permitidas)
- `https://10.11.0.250`
- `https://10.11.0.250:444`
- `https://firewall.empresa.com:8443`
- `http://192.168.1.1`
- `https://fw.exemplo.com.br`

### URLs Inválidas (bloqueadas)
- `https://10.11.0.250:444/login?redir=%2F` (tem path e query)
- `https://firewall.empresa.com/api/v2` (tem path)
- `https://192.168.1.1:8443/` (tem barra final)
- `https://fw.com?token=abc` (tem query string)

### Regex de Validação

```typescript
// Valida: protocolo + host (IP ou domínio) + porta opcional, SEM path/query/fragment
const isValidBaseUrl = (url: string): boolean => {
  // Remove espaços em branco
  const trimmed = url.trim();
  
  // Regex: protocolo://host(:porta)? - sem nada depois
  const baseUrlPattern = /^https?:\/\/[a-zA-Z0-9]([a-zA-Z0-9\-\.]*[a-zA-Z0-9])?(:\d{1,5})?$/;
  
  return baseUrlPattern.test(trimmed);
};
```

**Explicação da regex:**
- `^https?://` - Começa com http:// ou https://
- `[a-zA-Z0-9]` - Host começa com alfanumérico
- `([a-zA-Z0-9\-\.]*[a-zA-Z0-9])?` - Permite hífens e pontos no meio, termina com alfanumérico
- `(:\d{1,5})?` - Porta opcional (1-5 dígitos)
- `$` - Termina aqui (nenhum caractere adicional)

## Alterações Necessárias

### 1. Criar função utilitária de validação

**Arquivo**: `src/lib/urlValidation.ts` (novo)

Função reutilizável para validar URLs base de dispositivos de rede.

### 2. Atualizar AddFirewallDialog

**Arquivo**: `src/components/firewall/AddFirewallDialog.tsx`

- Adicionar estado `urlError` para mensagem de erro
- Validar URL no `onChange` do input
- Exibir mensagem de erro abaixo do campo
- Desabilitar botão "Adicionar" se URL inválida

### 3. Atualizar EditFirewallDialog

**Arquivo**: `src/components/firewall/EditFirewallDialog.tsx`

- Mesmas alterações do AddFirewallDialog
- Garantir que URLs existentes inválidas sejam corrigidas antes de salvar

## Implementação Visual

```text
┌────────────────────────────────────────────────┐
│ URL do FortiGate *                             │
│ ┌────────────────────────────────────────────┐ │
│ │ https://10.11.0.250:444/login?redir=%2F    │ │
│ └────────────────────────────────────────────┘ │
│ ⚠️ URL inválida. Use apenas o endereço base   │
│    (ex: https://192.168.1.1:8443)             │
└────────────────────────────────────────────────┘
```

## Detalhes Técnicos

### src/lib/urlValidation.ts

```typescript
/**
 * Valida se a URL é uma URL base válida para dispositivos de rede.
 * Aceita: protocolo://host(:porta)?
 * Rejeita: paths, query strings, fragmentos
 */
export function isValidDeviceBaseUrl(url: string): boolean {
  if (!url) return false;
  
  const trimmed = url.trim();
  
  // Regex: protocolo://host(:porta)? - sem path/query/fragment
  const baseUrlPattern = /^https?:\/\/[a-zA-Z0-9]([a-zA-Z0-9\-\.]*[a-zA-Z0-9])?(:\d{1,5})?$/;
  
  return baseUrlPattern.test(trimmed);
}

/**
 * Retorna mensagem de erro para URL inválida, ou null se válida.
 */
export function getDeviceUrlError(url: string): string | null {
  if (!url) return null; // Campo vazio será validado como obrigatório
  
  const trimmed = url.trim();
  
  // Verifica se tem protocolo
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
    return 'URL deve começar com http:// ou https://';
  }
  
  // Verifica se tem path, query ou fragment
  try {
    const parsed = new URL(trimmed);
    if (parsed.pathname !== '/' && parsed.pathname !== '') {
      return 'URL não deve conter caminho (path). Use apenas o endereço base.';
    }
    if (parsed.search) {
      return 'URL não deve conter parâmetros (?...). Use apenas o endereço base.';
    }
    if (parsed.hash) {
      return 'URL não deve conter fragmento (#...). Use apenas o endereço base.';
    }
  } catch {
    return 'URL inválida. Exemplo: https://192.168.1.1:8443';
  }
  
  // Verifica barra final desnecessária
  if (trimmed.endsWith('/')) {
    return 'Remova a barra (/) do final da URL.';
  }
  
  return null;
}
```

### Alterações em AddFirewallDialog.tsx

1. Import da função de validação
2. Estado para erro de URL: `const [urlError, setUrlError] = useState<string | null>(null);`
3. Handler do input com validação:
```typescript
onChange={(e) => {
  const newUrl = e.target.value;
  setFormData({ ...formData, fortigate_url: newUrl });
  setUrlError(getDeviceUrlError(newUrl));
}}
```
4. Exibição do erro:
```tsx
{urlError && (
  <p className="text-sm text-destructive">{urlError}</p>
)}
```
5. Desabilitar submit: `disabled={saving || !!urlError || !formData.fortigate_url}`

### Alterações em EditFirewallDialog.tsx

Mesmas alterações aplicadas ao formulário de edição.

## Benefícios

1. **Prevenção de erros**: Impede URLs malformadas antes de salvar
2. **Feedback imediato**: Usuário vê o erro enquanto digita
3. **Mensagens claras**: Explica exatamente o problema e como corrigir
4. **Não bloqueia portas**: Permite qualquer porta válida (1-65535)
