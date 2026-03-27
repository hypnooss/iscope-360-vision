import { motion } from 'framer-motion';
import { Card } from './ui/Card';
import {
  Globe, Lock, ShieldCheck, Mail,
  KeyRound, Search, AlertOctagon
} from 'lucide-react';

const features = [
  {
    icon: Globe,
    title: 'Análise DNS Completa',
    description: 'Verificação de registros A, AAAA, MX, TXT, NS, SOA, CNAME e CAA com validação detalhada.',
  },
  {
    icon: Lock,
    title: 'Verificação SSL/TLS',
    description: 'Validade do certificado, cadeia de confiança, algoritmo de criptografia e Subject Alternative Names.',
  },
  {
    icon: ShieldCheck,
    title: 'Headers HTTP de Segurança',
    description: 'HSTS, Content-Security-Policy, X-Frame-Options, X-Content-Type-Options e mais.',
  },
  {
    icon: Mail,
    title: 'Autenticação de Email',
    description: 'Validação completa de SPF, DKIM e DMARC para proteger contra spoofing e phishing.',
  },
  {
    icon: KeyRound,
    title: 'DNSSEC',
    description: 'Verificação de assinatura DNSSEC e integridade da cadeia de confiança DNS.',
  },
  {
    icon: Search,
    title: 'Enumeração de Subdomínios',
    description: 'Descoberta ativa e passiva de subdomínios com engine Amass integrada.',
  },
  {
    icon: AlertOctagon,
    title: 'Subdomain Takeover',
    description: 'Detecção automática de subdomínios vulneráveis a takeover por CNAME pendente.',
  },
];

export function FeaturesSection() {
  return (
    <section id="funcionalidades" className="py-24 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <span className="text-brand text-sm font-semibold uppercase tracking-wider">Funcionalidades</span>
          <h2 className="font-heading text-3xl sm:text-4xl font-bold mt-3 mb-4">
            Visibilidade total dos seus <span className="text-gradient">domínios</span>
          </h2>
          <p className="text-text-muted max-w-2xl mx-auto">
            Cada aspecto da segurança do seu domínio é analisado e classificado automaticamente.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feat, i) => (
            <motion.div
              key={feat.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
            >
              <Card className="h-full hover:border-brand/30 group">
                <div className="w-10 h-10 rounded-lg bg-brand/10 border border-brand/20 flex items-center justify-center mb-4 group-hover:bg-brand/20 transition-colors">
                  <feat.icon className="w-5 h-5 text-brand" />
                </div>
                <h3 className="font-bold text-text mb-2">{feat.title}</h3>
                <p className="text-sm text-text-muted leading-relaxed">{feat.description}</p>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
