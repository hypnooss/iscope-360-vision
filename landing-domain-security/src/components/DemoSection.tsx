import { motion } from 'framer-motion';
import { Button } from './ui/Button';
import { Sparkles, ArrowRight } from 'lucide-react';

export function DemoSection() {
  return (
    <section className="py-24">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="relative overflow-hidden rounded-3xl p-10 sm:p-14 text-center"
          style={{
            background: 'linear-gradient(145deg, hsla(175, 80%, 45%, 0.1), hsla(220, 70%, 55%, 0.1))',
            border: '1px solid hsla(175, 80%, 45%, 0.25)',
          }}
        >
          {/* Glow */}
          <div
            className="absolute top-0 left-1/2 -translate-x-1/2 w-[400px] h-[200px] opacity-20 pointer-events-none"
            style={{ background: 'radial-gradient(ellipse, hsl(175, 80%, 45%), transparent 70%)' }}
          />

          <div className="relative">
            <div className="w-14 h-14 rounded-2xl bg-brand/20 border border-brand/30 flex items-center justify-center mx-auto mb-6">
              <Sparkles className="w-7 h-7 text-brand" />
            </div>

            <h2 className="font-heading text-3xl sm:text-4xl font-bold mb-4">
              Experimente o poder do iSCOPE
            </h2>

            <p className="text-text-muted max-w-lg mx-auto mb-4 text-lg">
              Cadastre <span className="text-brand font-semibold">1 domínio gratuitamente</span> e receba
              uma análise com informações reduzidas para conhecer a plataforma.
            </p>

            <p className="text-text-dim text-sm mb-8 max-w-md mx-auto">
              Na demo você terá acesso a verificações básicas de DNS, SSL e headers.
              Para resultados completos com subdomínios, WHOIS e monitoramento, contrate um plano.
            </p>

            <Button size="lg">
              Solicite sua Demo Gratuita
              <ArrowRight className="w-5 h-5" />
            </Button>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
