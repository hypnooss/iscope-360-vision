import { motion } from 'framer-motion';
import { Button } from './ui/Button';
import { Check, ArrowRight, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';

const plans = [
  {
    name: 'Starter',
    domains: '1 a 3 domínios',
    monthlyPrice: '166,58',
    yearlyPrice: '1.999',
    popular: false,
    features: [
      'Análise DNS completa',
      'Verificação SSL/TLS',
      'Headers de segurança',
      'Score de compliance',
      'Monitoramento de certificados',
      'Alertas de expiração',
      'Agendamento automático',
    ],
  },
  {
    name: 'Professional',
    domains: '1 a 5 domínios',
    monthlyPrice: '208,25',
    yearlyPrice: '2.499',
    popular: true,
    features: [
      'Tudo do Starter',
      'SPF, DKIM e DMARC',
      'Enumeração de subdomínios',
      'Detecção de takeover',
      'DNSSEC',
      'Dashboard consolidado',
      'Relatórios históricos',
    ],
  },
  {
    name: 'Enterprise',
    domains: '1 a 10 domínios',
    monthlyPrice: '308,25',
    yearlyPrice: '3.699',
    popular: false,
    features: [
      'Tudo do Professional',
      'Até 10 domínios',
      'Análise WHOIS detalhada',
      'Suporte prioritário',
      'API de integração',
      'Relatórios executivos',
      'SLA de atendimento',
    ],
  },
];

export function PricingSection() {
  return (
    <section id="planos" className="py-24 relative">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-brand/[0.03] to-transparent pointer-events-none" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <span className="text-brand text-sm font-semibold uppercase tracking-wider">Planos</span>
          <h2 className="font-heading text-3xl sm:text-4xl font-bold mt-3 mb-4">
            Escolha o plano ideal para sua <span className="text-gradient">operação</span>
          </h2>
          <p className="text-text-muted max-w-2xl mx-auto">
            Pagamento anual parcelado mensalmente no cartão. Cancele quando quiser.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {plans.map((plan, i) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.12 }}
              className={cn(
                "relative rounded-2xl p-8 border transition-all",
                plan.popular
                  ? "border-brand/40 bg-gradient-to-b from-brand/[0.08] to-surface-raised shadow-lg shadow-brand/10 scale-[1.02]"
                  : "border-surface-border bg-surface-raised"
              )}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-brand text-surface text-xs font-bold uppercase tracking-wider">
                  Mais Popular
                </div>
              )}

              <h3 className="font-heading text-xl font-bold text-text mb-1">{plan.name}</h3>
              <p className="text-sm text-text-muted mb-6">{plan.domains}</p>

              <div className="mb-6">
                <div className="flex items-baseline gap-1">
                  <span className="text-text-muted text-lg">R$</span>
                  <span className="text-4xl font-extrabold text-text font-heading">{plan.monthlyPrice}</span>
                  <span className="text-text-muted text-sm">/mês</span>
                </div>
                <p className="text-xs text-text-dim mt-1">
                  R$ {plan.yearlyPrice},00/ano no cartão
                </p>
              </div>

              <Button
                variant={plan.popular ? 'primary' : 'outline'}
                className="w-full mb-6"
              >
                Começar Agora
                <ArrowRight className="w-4 h-4" />
              </Button>

              <ul className="space-y-3">
                {plan.features.map((feat) => (
                  <li key={feat} className="flex items-start gap-2 text-sm text-text-muted">
                    <Check className="w-4 h-4 text-brand flex-shrink-0 mt-0.5" />
                    {feat}
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>

        {/* Custom plan */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-2xl mx-auto text-center p-8 rounded-2xl border border-surface-border bg-surface-raised"
        >
          <h3 className="font-heading text-xl font-bold mb-2">Mais de 10 domínios?</h3>
          <p className="text-text-muted text-sm mb-6">
            Entre em contato para um plano personalizado com volume de domínios e condições especiais.
          </p>
          <Button variant="outline">
            <MessageSquare className="w-4 h-4" />
            Fale Conosco
          </Button>
        </motion.div>
      </div>
    </section>
  );
}
