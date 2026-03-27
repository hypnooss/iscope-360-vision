import { motion } from 'framer-motion';
import { Globe, Scan, BarChart3 } from 'lucide-react';

const steps = [
  {
    icon: Globe,
    step: '01',
    title: 'Cadastre seu domínio',
    description: 'Informe o domínio que deseja monitorar. Sem instalação, sem configuração complexa.',
  },
  {
    icon: Scan,
    step: '02',
    title: 'Análise automática',
    description: 'Nossa engine analisa DNS, SSL, headers, subdomínios e mais em poucos minutos.',
  },
  {
    icon: BarChart3,
    step: '03',
    title: 'Score e recomendações',
    description: 'Receba um score de 0 a 100 com recomendações claras para corrigir cada vulnerabilidade.',
  },
];

export function HowItWorksSection() {
  return (
    <section className="py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <span className="text-brand text-sm font-semibold uppercase tracking-wider">Como Funciona</span>
          <h2 className="font-heading text-3xl sm:text-4xl font-bold mt-3 mb-4">
            Três passos para <span className="text-gradient">visibilidade total</span>
          </h2>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {steps.map((item, i) => (
            <motion.div
              key={item.step}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.15 }}
              className="relative text-center"
            >
              {/* Connector line */}
              {i < steps.length - 1 && (
                <div className="hidden md:block absolute top-12 left-[60%] w-[80%] h-px bg-gradient-to-r from-brand/40 to-transparent" />
              )}
              <div className="w-20 h-20 rounded-2xl bg-brand/10 border border-brand/20 flex items-center justify-center mx-auto mb-6 relative">
                <item.icon className="w-8 h-8 text-brand" />
                <span className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-brand text-surface text-xs font-bold flex items-center justify-center">
                  {item.step}
                </span>
              </div>
              <h3 className="text-lg font-bold text-text mb-2">{item.title}</h3>
              <p className="text-sm text-text-muted max-w-xs mx-auto leading-relaxed">{item.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
