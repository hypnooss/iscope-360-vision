import { motion } from 'framer-motion';
import { Card } from './ui/Card';
import {
  FileCheck, CalendarClock, TrendingUp,
  LayoutDashboard, Timer
} from 'lucide-react';

const capabilities = [
  {
    icon: FileCheck,
    title: 'Monitoramento de Certificados SSL',
    description: 'Acompanhe a vida útil de cada certificado. Receba alertas antes da expiração para evitar downtime.',
  },
  {
    icon: CalendarClock,
    title: 'Alertas de Expiração de Domínios',
    description: 'Monitoramento via WHOIS: saiba quando seus domínios vencem e evite perda de propriedade.',
  },
  {
    icon: TrendingUp,
    title: 'Score Histórico de Compliance',
    description: 'Acompanhe a evolução do score de segurança ao longo do tempo com gráficos e relatórios.',
  },
  {
    icon: LayoutDashboard,
    title: 'Dashboard Consolidado',
    description: 'Visão única de todos os domínios monitorados: status, score, certificados e alertas.',
  },
  {
    icon: Timer,
    title: 'Agendamento Automático',
    description: 'Configure varreduras diárias, semanais ou mensais. A análise roda automaticamente.',
  },
];

export function MonitoringSection() {
  return (
    <section id="monitoramento" className="py-24 relative">
      {/* Accent background */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-brand/[0.03] to-transparent pointer-events-none" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <span className="text-brand text-sm font-semibold uppercase tracking-wider">Gestão de Ativos</span>
          <h2 className="font-heading text-3xl sm:text-4xl font-bold mt-3 mb-4">
            Monitoramento <span className="text-gradient">contínuo</span> da sua infraestrutura
          </h2>
          <p className="text-text-muted max-w-2xl mx-auto">
            Não basta analisar uma vez. Monitore continuamente certificados, domínios e compliance.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {capabilities.map((cap, i) => (
            <motion.div
              key={cap.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
            >
              <Card className="h-full hover:border-brand/30 group">
                <div className="w-10 h-10 rounded-lg bg-brand/10 border border-brand/20 flex items-center justify-center mb-4 group-hover:bg-brand/20 transition-colors">
                  <cap.icon className="w-5 h-5 text-brand" />
                </div>
                <h3 className="font-bold text-text mb-2">{cap.title}</h3>
                <p className="text-sm text-text-muted leading-relaxed">{cap.description}</p>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
