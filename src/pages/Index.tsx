import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/button';
import {
  CheckCircle2, AlertTriangle, TrendingUp, ArrowRight, Shield,
  Network, Eye, Zap, Lock, ChevronRight,
} from 'lucide-react';

/* ── Scroll Reveal ── */
function SectionReveal({ children, className = '', delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold: 0.1 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      style={{ transitionDelay: `${delay}ms` }}
      className={`transition-all duration-700 ease-out ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'} ${className}`}
    >
      {children}
    </div>
  );
}

/* ── Animated Background with floating orbs + grid ── */
function AnimatedBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      {/* Floating orbs */}
      <div
        className="absolute w-[600px] h-[600px] rounded-full opacity-[0.07]"
        style={{
          background: 'radial-gradient(circle, hsl(175 80% 45%), transparent 70%)',
          top: '10%',
          left: '15%',
          filter: 'blur(180px)',
          animation: 'orb-drift-1 25s ease-in-out infinite',
        }}
      />
      <div
        className="absolute w-[500px] h-[500px] rounded-full opacity-[0.05]"
        style={{
          background: 'radial-gradient(circle, hsl(190 80% 40%), transparent 70%)',
          top: '50%',
          right: '10%',
          filter: 'blur(160px)',
          animation: 'orb-drift-2 30s ease-in-out infinite',
        }}
      />
      <div
        className="absolute w-[400px] h-[400px] rounded-full opacity-[0.06]"
        style={{
          background: 'radial-gradient(circle, hsl(175 60% 50%), transparent 70%)',
          bottom: '15%',
          left: '40%',
          filter: 'blur(200px)',
          animation: 'orb-drift-3 35s ease-in-out infinite',
        }}
      />

      {/* Grid overlay with radial fade */}
      <div className="absolute inset-0 animated-grid-dots grid-radial-mask" />
    </div>
  );
}

/* ── Page ── */
const Index = () => {
  const { user, loading, mfaRequired, mfaEnrolled } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) {
      if (mfaRequired) {
        navigate(mfaEnrolled ? '/mfa/challenge' : '/mfa/enroll');
      } else {
        navigate('/dashboard');
      }
    }
  }, [user, loading, navigate, mfaRequired, mfaEnrolled]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col relative">
      <AnimatedBackground />
      <Header />

      <main className="flex-1 relative z-10">
        {/* ═══ HERO ═══ */}
        <section className="min-h-screen flex items-center justify-center px-6">
          <div className="text-center max-w-3xl mx-auto">
            <SectionReveal delay={100}>
              <h1 className="font-heading text-[2.75rem] sm:text-[3.5rem] lg:text-[4.5rem] font-extrabold leading-[1.05] tracking-tight mb-6">
                Gerencie sua infraestrutura{' '}
                <span className="text-primary">com inteligência</span>
              </h1>
            </SectionReveal>

            <SectionReveal delay={200}>
              <p className="text-lg lg:text-xl text-muted-foreground max-w-2xl mx-auto mb-12 leading-relaxed">
                Plataforma completa para análise de compliance, segurança e
                boas práticas da sua infraestrutura.
              </p>
            </SectionReveal>

            <SectionReveal delay={300}>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button
                  size="lg"
                  onClick={() => navigate('/auth')}
                  className="gap-2 h-13 px-8 text-base font-semibold shadow-[0_0_30px_hsl(175_80%_45%/0.2)] hover:shadow-[0_0_50px_hsl(175_80%_45%/0.35)] transition-shadow duration-300"
                >
                  Acessar Plataforma <ArrowRight className="w-5 h-5" />
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={() => document.querySelector('#how-it-works')?.scrollIntoView({ behavior: 'smooth' })}
                  className="gap-2 h-13 px-8 text-base font-semibold"
                >
                  Ver como funciona <ChevronRight className="w-5 h-5" />
                </Button>
              </div>
            </SectionReveal>
          </div>
        </section>

        {/* ═══ CREDIBILITY + METRICS ═══ */}
        <section className="min-h-screen flex items-center justify-center px-6 bg-card/20">
          <div className="max-w-[1200px] mx-auto w-full">
            <SectionReveal>
              <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground/60 mb-12 font-medium text-center">
                Construído para ambientes corporativos
              </p>
              <div className="flex flex-wrap items-center justify-center gap-10 mb-20">
                {['Enterprise A', 'Enterprise B', 'Enterprise C', 'Enterprise D'].map((name) => (
                  <div
                    key={name}
                    className="h-8 px-6 rounded bg-muted/20 flex items-center justify-center text-xs text-muted-foreground/40 font-medium tracking-wider"
                  >
                    {name}
                  </div>
                ))}
              </div>
            </SectionReveal>
            <SectionReveal delay={150}>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-3xl mx-auto text-center">
                {[
                  { number: '50+', label: 'Verificações de Compliance' },
                  { number: '360°', label: 'Visibilidade da Infraestrutura' },
                  { number: 'Zero', label: 'Intervenção Manual' },
                ].map((m) => (
                  <div key={m.label}>
                    <div className="text-4xl lg:text-5xl font-heading font-extrabold text-primary mb-2">{m.number}</div>
                    <div className="text-sm text-muted-foreground font-medium">{m.label}</div>
                  </div>
                ))}
              </div>
            </SectionReveal>
          </div>
        </section>

        {/* ═══ FEATURES ═══ */}
        <section id="features" className="min-h-screen flex items-center justify-center px-6">
          <div className="max-w-[1200px] mx-auto w-full">
            <SectionReveal>
              <div className="text-center mb-16">
                <h2 className="font-heading text-3xl lg:text-[2.25rem] font-bold mb-4">
                  Tudo que você precisa em um só lugar
                </h2>
                <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
                  Ferramentas poderosas para manter sua infraestrutura segura e em conformidade.
                </p>
              </div>
            </SectionReveal>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                {
                  icon: CheckCircle2,
                  title: 'Verificações Automáticas',
                  description: 'Mais de 50 pontos de verificação baseados em boas práticas de mercado.',
                },
                {
                  icon: Shield,
                  title: 'Detecção de Riscos',
                  description: 'Identifica vulnerabilidades e configurações inseguras automaticamente.',
                },
                {
                  icon: TrendingUp,
                  title: 'Recomendações',
                  description: 'Sugestões práticas e acionáveis para melhorar sua postura de segurança.',
                },
              ].map((f, i) => (
                <SectionReveal key={f.title} delay={i * 100}>
                  <div className="feature-card group h-full">
                    <div className="inline-flex p-3.5 rounded-xl bg-primary/10 mb-5 group-hover:bg-primary/15 transition-colors duration-300">
                      <f.icon className="w-6 h-6 text-primary" />
                    </div>
                    <h3 className="font-heading font-bold text-xl text-foreground mb-3">{f.title}</h3>
                    <p className="text-[15px] text-muted-foreground leading-relaxed">{f.description}</p>
                  </div>
                </SectionReveal>
              ))}
            </div>
          </div>
        </section>

        {/* ═══ HOW IT WORKS ═══ */}
        <section id="how-it-works" className="min-h-screen flex items-center justify-center px-6 bg-card/20">
          <div className="max-w-[1200px] mx-auto w-full">
            <SectionReveal>
              <div className="text-center mb-20">
                <h2 className="font-heading text-3xl lg:text-[2.25rem] font-bold mb-4">
                  Como funciona
                </h2>
                <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
                  Três passos simples para ter visibilidade total da sua infraestrutura.
                </p>
              </div>
            </SectionReveal>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
              <div className="hidden md:block absolute top-14 left-[20%] right-[20%] h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
              {[
                { num: '01', icon: Network, title: 'Conecte sua infraestrutura', desc: 'Integre firewalls, servidores e serviços de nuvem em minutos.' },
                { num: '02', icon: Zap, title: 'Execute a análise automatizada', desc: 'Nossa engine avalia centenas de pontos de compliance e segurança.' },
                { num: '03', icon: Eye, title: 'Receba recomendações acionáveis', desc: 'Visualize resultados e aplique correções com orientação clara.' },
              ].map((step, i) => (
                <SectionReveal key={step.num} delay={i * 150}>
                  <div className="text-center relative">
                    <div className="inline-flex items-center justify-center w-28 h-28 rounded-full bg-card border border-border/40 mb-6 relative z-10 shadow-lg shadow-background/50">
                      <span className="text-3xl font-heading font-extrabold text-primary">{step.num}</span>
                    </div>
                    <h3 className="font-heading font-bold text-lg text-foreground mb-2">{step.title}</h3>
                    <p className="text-sm text-muted-foreground max-w-xs mx-auto leading-relaxed">{step.desc}</p>
                  </div>
                </SectionReveal>
              ))}
            </div>
          </div>
        </section>

        {/* ═══ SECURITY & TRUST ═══ */}
        <section id="security" className="min-h-screen flex items-center justify-center px-6">
          <div className="max-w-[1200px] mx-auto w-full">
            <SectionReveal>
              <div className="text-center mb-16">
                <h2 className="font-heading text-3xl lg:text-[2.25rem] font-bold mb-4">
                  Segurança em primeiro lugar
                </h2>
                <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
                  Projetado para atender os mais altos padrões de segurança corporativa.
                </p>
              </div>
            </SectionReveal>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-3xl mx-auto">
              {[
                { icon: Zap, title: 'Análise automatizada', desc: 'Varredura completa sem intervenção manual.' },
                { icon: AlertTriangle, title: 'Detecção de configurações inseguras', desc: 'Identifica problemas antes que se tornem incidentes.' },
                { icon: Shield, title: 'Boas práticas de segurança', desc: 'Baseado em frameworks reconhecidos do mercado.' },
                { icon: Lock, title: 'Visibilidade da infraestrutura', desc: 'Painel unificado com visão 360° do seu ambiente.' },
              ].map((item, i) => (
                <SectionReveal key={item.title} delay={i * 100}>
                  <div className="feature-card flex gap-4 items-start h-full">
                    <div className="shrink-0 p-3 rounded-xl bg-primary/10">
                      <item.icon className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-heading font-bold text-foreground mb-1.5">{item.title}</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                </SectionReveal>
              ))}
            </div>
          </div>
        </section>

        {/* ═══ CTA ═══ */}
        <section className="min-h-screen flex items-center justify-center px-6 bg-card/20">
          <div className="max-w-[1200px] mx-auto w-full">
            <SectionReveal>
              <div className="cta-gradient rounded-2xl border border-primary/20 px-8 py-24 lg:py-28 text-center relative overflow-hidden">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] rounded-full bg-primary/8 blur-[100px] pointer-events-none" />
                <div className="relative z-10">
                  <h2 className="font-heading text-3xl lg:text-[2.25rem] font-bold mb-5">
                    Comece a analisar sua infraestrutura hoje
                  </h2>
                  <p className="text-muted-foreground max-w-xl mx-auto mb-10 text-lg">
                    Descubra vulnerabilidades, melhore sua postura de segurança e mantenha compliance contínuo.
                  </p>
                  <Button
                    size="lg"
                    onClick={() => navigate('/auth')}
                    className="gap-2 px-12 h-14 text-base font-semibold shadow-[0_0_40px_hsl(175_80%_45%/0.25)] hover:shadow-[0_0_60px_hsl(175_80%_45%/0.4)] transition-shadow duration-300 animate-pulse-glow"
                  >
                    Acessar Plataforma <ArrowRight className="w-5 h-5" />
                  </Button>
                </div>
              </div>
            </SectionReveal>
          </div>
        </section>
      </main>

      {/* ═══ FOOTER ═══ */}
      <footer className="relative z-10 border-t border-border/20">
        <div className="max-w-[1200px] mx-auto px-6 py-10 flex flex-col md:flex-row items-center justify-between gap-6">
          <p className="text-sm text-muted-foreground/60">
            © {new Date().getFullYear()} Precisio Analytics. Todos os direitos reservados.
          </p>
          <div className="flex gap-8">
            {['Produto', 'Documentação', 'Segurança', 'Contato'].map((link) => (
              <a key={link} href="#" className="text-sm text-muted-foreground/60 hover:text-foreground transition-colors duration-200">
                {link}
              </a>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
