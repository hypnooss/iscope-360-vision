import { motion } from 'framer-motion';
import { Button } from './ui/Button';
import { ArrowRight, Shield } from 'lucide-react';

export function CtaSection() {
  return (
    <section className="py-24 relative overflow-hidden">
      {/* Background glow */}
      <div
        className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] opacity-10 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse, hsl(175, 80%, 45%), transparent 70%)' }}
      />

      <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <Shield className="w-12 h-12 text-brand mx-auto mb-6" />

          <h2 className="font-heading text-3xl sm:text-5xl font-extrabold mb-6">
            Proteja seus domínios <span className="text-gradient">agora</span>
          </h2>

          <p className="text-lg text-text-muted max-w-xl mx-auto mb-10">
            Comece com uma demo gratuita e descubra o nível real de segurança da sua infraestrutura de domínios.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button size="lg">
              Solicite uma Demo
              <ArrowRight className="w-5 h-5" />
            </Button>
            <Button variant="outline" size="lg">
              <a href="#planos">Ver Planos e Preços</a>
            </Button>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
