import { EvidenceItem } from '@/types/compliance';

// Mapear campos técnicos para labels legíveis em português
const FIELD_LABELS: Record<string, string> = {
  name: 'Nome',
  host: 'Host',
  value: 'Valor',
  selector: 'Seletor',
  key_type: 'Tipo de Chave',
  key_size_bits: 'Tamanho da Chave (bits)',
  priority: 'Prioridade',
  exchange: 'Servidor MX',
  txt_raw: 'Registro TXT',
  flags: 'Flags',
  record: 'Registro',
  policy: 'Política',
  rua: 'Relatórios (rua)',
  ruf: 'Relatórios Forenses (ruf)',
  pct: 'Percentual',
  sp: 'Política de Subdomínio',
  adkim: 'Alinhamento DKIM',
  aspf: 'Alinhamento SPF',
  ttl: 'TTL',
  type: 'Tipo',
  ip: 'IP',
  ipv4: 'IPv4',
  ipv6: 'IPv6',
  cname: 'CNAME',
  target: 'Destino',
  expire: 'Expiração',
  minimum: 'Mínimo',
  refresh: 'Refresh',
  retry: 'Retry',
  serial: 'Serial',
  mname: 'Nameserver Primário',
  rname: 'Email do Responsável',
};

// Campos que devem ser ocultados (muito técnicos ou longos)
const HIDDEN_FIELDS = ['p_length', 'p', 'txt_raw'];

interface RecordDisplayProps {
  record: Record<string, unknown>;
}

function RecordDisplay({ record }: RecordDisplayProps) {
  const entries = Object.entries(record)
    .filter(([key, value]) => 
      value !== null && 
      value !== undefined && 
      value !== '' &&
      !HIDDEN_FIELDS.includes(key)
    );

  if (entries.length === 0) return null;

  return (
    <div className="border-l-2 border-primary/30 pl-3 space-y-1">
      {entries.map(([key, value]) => (
        <div key={key} className="flex flex-col">
          <span className="text-xs text-muted-foreground">
            {FIELD_LABELS[key] || key}
          </span>
          <span className="text-sm text-foreground font-mono break-all">
            {typeof value === 'object' ? JSON.stringify(value) : String(value)}
          </span>
        </div>
      ))}
    </div>
  );
}

interface FormattedCodeEvidenceProps {
  item: EvidenceItem;
}

function FormattedCodeEvidence({ item }: FormattedCodeEvidenceProps) {
  // Tentar parsear JSON
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(item.value);
  } catch {
    // Não é JSON válido
  }

  // Se for array de objetos (ex: registros DKIM, MX), renderizar como lista
  if (Array.isArray(parsed) && parsed.length > 0) {
    // Se for array de strings simples
    if (typeof parsed[0] === 'string') {
      return (
        <div className="bg-muted/30 rounded-md p-3 border border-border/30 space-y-2">
          {parsed.map((val, idx) => (
            <div key={idx} className="flex flex-col">
              <span className="text-xs font-medium text-muted-foreground">{item.label}</span>
              <span className="text-sm text-foreground font-mono">{String(val)}</span>
            </div>
          ))}
        </div>
      );
    }
    
    // Se for array de objetos
    if (typeof parsed[0] === 'object') {
      return (
        <div className="bg-muted/30 rounded-md p-3 border border-border/30 space-y-3">
          <span className="text-xs font-medium text-muted-foreground block">{item.label}</span>
          {parsed.map((record, idx) => (
            <RecordDisplay key={idx} record={record as Record<string, unknown>} />
          ))}
        </div>
      );
    }
  }

  // Se for objeto simples
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    return (
      <div className="bg-muted/30 rounded-md p-3 border border-border/30 space-y-2">
        <span className="text-xs font-medium text-muted-foreground block">{item.label}</span>
        <RecordDisplay record={parsed as Record<string, unknown>} />
      </div>
    );
  }

  // Fallback: exibir como código formatado
  return (
    <div className="bg-muted/30 rounded-md p-3 border border-border/30">
      <span className="text-xs font-medium text-muted-foreground block mb-1">{item.label}</span>
      <code className="text-xs text-primary bg-background/50 px-2 py-1 rounded block overflow-x-auto whitespace-pre-wrap">
        {item.value}
      </code>
    </div>
  );
}

interface EvidenceItemDisplayProps {
  item: EvidenceItem;
}

export function EvidenceItemDisplay({ item }: EvidenceItemDisplayProps) {
  // Detectar se é uma lista (múltiplos valores separados por vírgula)
  const isList = item.value.includes(',') && item.type !== 'code' && item.type !== 'json';
  
  // Renderização especial para listas (ex: nameservers, registros MX)
  if (isList) {
    const values = item.value.split(',').map(v => v.trim()).filter(Boolean);
    return (
      <div className="bg-muted/30 rounded-md p-3 border border-border/30 space-y-2">
        {values.map((val, idx) => (
          <div key={idx} className="flex flex-col">
            <span className="text-xs font-medium text-muted-foreground">{item.label}</span>
            <span className="text-sm text-foreground font-mono">{val}</span>
          </div>
        ))}
      </div>
    );
  }
  
  // Renderização para JSON/código
  if (item.type === 'code' || item.type === 'json') {
    return <FormattedCodeEvidence item={item} />;
  }
  
  // Renderização padrão para texto simples
  return (
    <div className="bg-muted/30 rounded-md p-3 border border-border/30">
      <span className="text-xs font-medium text-muted-foreground block mb-1">{item.label}</span>
      <p className="text-sm text-foreground">{item.value}</p>
    </div>
  );
}
