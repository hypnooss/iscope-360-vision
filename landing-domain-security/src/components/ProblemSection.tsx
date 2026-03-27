import { motion } from 'framer-motion';
import { Card } from './ui/Card';
import { AlertTriangle, Wifi, Ghost } from 'lucide-react';

const problems = [
  {
    icon: AlertTriangle,
    title: 'Certificados expirados',
    description: 'Seus certificados SSL vencem sem que ninguém perceba. Visitantes veem alertas de segurança e abandonam seu site.',
  },
  {
    icon: Wifi,
    title: 'DNS mal configurado',
    description: 'Registros SPF, DKIM e DMARC ausentes ou incorretos permitem spoofing de e-mails e prejudicam sua reputação.',
  },
  {
    icon: Ghost,
    title: 'Subdomínios esquecidos',
    description: 'Subdomínios antigos apontando para serviços desativados são alvos fáceis para subdomain takeover.',
  },
];

export function ProblemSection() {
  return (
    <section className="py-24 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="font-heading text-3xl sm:text-4xl font-bold mb-4">
            Você sabe o que está <span className="text-gradient">exposto</span>?
          </h2>
          <p className="text-text-muted max-w-2xl mx-auto">
            A maioria das empresas só descobre problemas de segurança em domínios quando já é tarde demais.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {problems.map((item, i) => (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.15 }}
            >
              <Card className="h-full hover:border-red-500/30 group">
                <div className="w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-4 group-hover:bg-red-500/20 transition-colors">
                  <item.icon className="w-6 h-6 text-red-400" />
                </div>
                <h3 className="text-lg font-bold text-text mb-2">{item.title}</h3>
                <p className="text-sm text-text-muted leading-relaxed">{item.description}</p>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
