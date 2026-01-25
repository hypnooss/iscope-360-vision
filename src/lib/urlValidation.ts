/**
 * Utilitários de validação de URL para dispositivos de rede.
 * Garante que apenas URLs base (sem paths, query strings ou fragmentos) sejam aceitas.
 */

/**
 * Valida se a URL é uma URL base válida para dispositivos de rede.
 * Aceita: protocolo://host(:porta)?
 * Rejeita: paths, query strings, fragmentos
 */
export function isValidDeviceBaseUrl(url: string): boolean {
  if (!url) return false;
  
  const trimmed = url.trim();
  
  // Regex: protocolo://host(:porta)? - sem path/query/fragment
  // Suporta IPs e domínios com subdomínios
  const baseUrlPattern = /^https?:\/\/[a-zA-Z0-9]([a-zA-Z0-9\-\.]*[a-zA-Z0-9])?(:\d{1,5})?$/;
  
  return baseUrlPattern.test(trimmed);
}

/**
 * Retorna mensagem de erro para URL inválida, ou null se válida.
 * Fornece feedback específico sobre o problema encontrado.
 */
export function getDeviceUrlError(url: string): string | null {
  if (!url) return null; // Campo vazio será validado como obrigatório separadamente
  
  const trimmed = url.trim();
  
  // Verifica se tem protocolo
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
    return 'URL deve começar com http:// ou https://';
  }
  
  // Verifica se tem path, query ou fragment usando URL API
  try {
    const parsed = new URL(trimmed);
    
    // pathname '/' é o padrão quando não há path explícito
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
  
  // Verifica barra final desnecessária (exceto se for só o protocolo + host)
  if (trimmed.endsWith('/')) {
    return 'Remova a barra (/) do final da URL.';
  }
  
  return null;
}
