import { motion } from 'framer-motion';
import { Button } from './ui/Button';
import { Shield, ArrowRight } from 'lucide-react';

export function HeroSection() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-16">
      {/* Background Effects */}
      <div className="absolute inset-0">
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: `
              linear-gradient(hsla(175, 80%, 45%, 0.05) 1px, transparent 1px),
              linear-gradient(90deg, hsla(175, 80%, 45%, 0.05) 1px, transparent 1px)
            `,
            backgroundSize: '48px 48px',
          }}
        />
        <div
          className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full opacity-15"
          style={{
            background: 'radial-gradient(circle, hsl(175, 80%, 45%), transparent 70%)',
          }}
        />
      </div>

      <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-brand/30 bg-brand/10 text-brand text-xs font-medium mb-8"
        >
          <Shield className="w-3.5 h-3.5" />
          Plataforma de Segurança de Domínios
        </motion.div>

        {/* Title */}
        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="font-heading text-4xl sm:text-5xl lg:text-7xl font-extrabold leading-tight mb-6"
        >
          Proteja seus domínios.
          <br />
          <span className="text-gradient">Monitore certificados.</span>
          <br />
          Elimine vulnerabilidades.
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="text-lg sm:text-xl text-text-muted max-w-2xl mx-auto mb-10"
        >
          Análise completa de DNS, SSL/TLS, headers de segurança e subdomínios.
          Saiba exatamente onde sua infraestrutura está exposta — antes que atacantes descubram.
        </motion.p>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <Button size="lg">
            Solicite uma Demo
            <ArrowRight className="w-5 h-5" />
          </Button>
          <Button variant="outline" size="lg">
            <a href="#planos">Ver Planos</a>
          </Button>
        </motion.div>

        {/* Trust indicators */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="mt-12 text-xs text-text-dim"
        >
          Sem instalação · Resultados em minutos · Compatível com qualquer domínio
        </motion.p>
      </div>
    </section>
  );
}
