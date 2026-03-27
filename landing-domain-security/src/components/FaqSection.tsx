import { motion } from 'framer-motion';
import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

const faqs = [
  {
    q: 'Como funciona a Demo?',
    a: 'Você cadastra 1 domínio gratuitamente e recebe uma análise com informações básicas de DNS, SSL e headers. Para acesso completo com subdomínios, WHOIS, monitoramento contínuo e agendamento, é necessário contratar um plano.',
  },
  {
    q: 'Preciso instalar algum software?',
    a: 'Não. O iSCOPE Domain Security é 100% em nuvem. Basta informar o domínio que deseja monitorar e a análise é feita automaticamente pela nossa infraestrutura.',
  },
  {
    q: 'Quais dados são coletados?',
    a: 'Coletamos informações públicas do domínio: registros DNS, certificados SSL, headers HTTP, informações WHOIS e subdomínios expostos. Não acessamos dados internos da sua rede.',
  },
  {
    q: 'Como funciona o pagamento?',
    a: 'O pagamento é anual, parcelado em 12x mensais no cartão de crédito. Você pode cancelar a qualquer momento, sem multa.',
  },
  {
    q: 'Posso trocar de plano depois?',
    a: 'Sim. Você pode fazer upgrade ou downgrade do seu plano a qualquer momento. A diferença é calculada proporcionalmente.',
  },
  {
    q: 'O que é o score de compliance?',
    a: 'É uma pontuação de 0 a 100 que avalia a segurança do seu domínio em quatro categorias: DNS, SSL/TLS, Headers HTTP e Subdomínios. Quanto maior, mais seguro.',
  },
];

export function FaqSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section id="faq" className="py-24">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <span className="text-brand text-sm font-semibold uppercase tracking-wider">FAQ</span>
          <h2 className="font-heading text-3xl sm:text-4xl font-bold mt-3">
            Perguntas Frequentes
          </h2>
        </motion.div>

        <div className="space-y-3">
          {faqs.map((faq, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
            >
              <button
                className="w-full text-left p-5 rounded-xl bg-surface-raised border border-surface-border hover:border-brand/30 transition-colors"
                onClick={() => setOpenIndex(openIndex === i ? null : i)}
              >
                <div className="flex items-center justify-between gap-4">
                  <span className="font-semibold text-text">{faq.q}</span>
                  <ChevronDown
                    className={cn(
                      "w-5 h-5 text-text-muted flex-shrink-0 transition-transform duration-200",
                      openIndex === i && "rotate-180"
                    )}
                  />
                </div>
                {openIndex === i && (
                  <p className="mt-3 text-sm text-text-muted leading-relaxed pr-8">
                    {faq.a}
                  </p>
                )}
              </button>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
