import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/button';
import {
  CheckCircle2, AlertTriangle, TrendingUp, ArrowRight, Shield,
  Network, Eye, Zap, Lock, ChevronRight,
} from 'lucide-react';
import dashboardPreview from '@/assets/dashboard-preview.png';

/* ── Scroll Reveal ── */
function SectionReveal({ children, className = '' }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold: 0.15 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'} ${className}`}
    >
      {children}
    </div>
  );
}

/* ── Animated Grid Background ── */
function AnimatedGrid() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <div className="animated-grid absolute inset-0" />
      {/* Glow orb */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-primary/5 blur-[120px] animate-glow-pulse" />
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
      <AnimatedGrid />
      <Header />

      <main className="flex-1 relative z-10">
        {/* ═══ HERO ═══ */}
        <section className="max-w-[1200px] mx-auto px-6 pt-20 pb-16 lg:pt-28 lg:pb-24">
          <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-16">
            {/* Text */}
            <div className="flex-1 text-center lg:text-left">
              <h1 className="font-heading text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight tracking-tight mb-6">
                Gerencie sua infraestrutura
                <span className="text-primary"> com inteligência</span>
              </h1>
              <p className="text-lg text-muted-foreground max-w-xl mx-auto lg:mx-0 mb-8">
                Plataforma completa para análise de compliance, segurança e
                boas práticas da sua infraestrutura de rede.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                <Button size="lg" onClick={() => navigate('/auth')} className="gap-2">
                  Acessar Plataforma <ArrowRight className="w-4 h-4" />
                </Button>
                <Button size="lg" variant="outline" onClick={() => {
                  document.querySelector('#how-it-works')?.scrollIntoView({ behavior: 'smooth' });
                }} className="gap-2">
                  Ver como funciona <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Dashboard Mockup */}
            <div className="flex-1 w-full max-w-2xl">
              <div className="animate-float">
                <div className="glass-container glow-border rounded-xl overflow-hidden">
                  <img
                    src={dashboardPreview}
                    alt="Dashboard iScope 360"
                    className="w-full h-auto"
                    loading="eager"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ═══ CREDIBILITY ═══ */}
        <SectionReveal>
          <section className="max-w-[1200px] mx-auto px-6 py-12 text-center">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-8">
              Construído para ambientes corporativos
            </p>
            <div className="flex flex-wrap items-center justify-center gap-10">
              {['Enterprise A', 'Enterprise B', 'Enterprise C', 'Enterprise D'].map((name) => (
                <div
                  key={name}
                  className="h-8 px-6 rounded bg-muted/30 flex items-center justify-center text-xs text-muted-foreground/50 font-medium tracking-wider"
                >
                  {name}
                </div>
              ))}
            </div>
          </section>
        </SectionReveal>

        {/* ═══ FEATURES ═══ */}
        <SectionReveal>
          <section id="features" className="max-w-[1200px] mx-auto px-6 py-16 lg:py-24">
            <div className="text-center mb-12">
              <h2 className="font-heading text-3xl lg:text-4xl font-semibold mb-4">
                Tudo que você precisa em um só lugar
              </h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Ferramentas poderosas para manter sua infraestrutura segura e em conformidade.
              </p>
            </div>
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
              ].map((f) => (
                <div key={f.title} className="feature-card">
                  <div className="inline-flex p-3 rounded-lg bg-primary/10 mb-4">
                    <f.icon className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="font-heading font-semibold text-lg text-foreground mb-2">{f.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{f.description}</p>
                </div>
              ))}
            </div>
          </section>
        </SectionReveal>

        {/* ═══ HOW IT WORKS ═══ */}
        <SectionReveal>
          <section id="how-it-works" className="max-w-[1200px] mx-auto px-6 py-16 lg:py-24">
            <div className="text-center mb-16">
              <h2 className="font-heading text-3xl lg:text-4xl font-semibold mb-4">
                Como funciona
              </h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Três passos simples para ter visibilidade total da sua infraestrutura.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
              {/* Connector line (desktop) */}
              <div className="hidden md:block absolute top-12 left-[16.67%] right-[16.67%] h-px bg-gradient-to-r from-primary/30 via-primary/60 to-primary/30" />

              {[
                { num: '01', icon: Network, title: 'Conecte sua infraestrutura', desc: 'Integre firewalls, servidores e serviços de nuvem em minutos.' },
                { num: '02', icon: Zap, title: 'Execute a análise automatizada', desc: 'Nossa engine avalia centenas de pontos de compliance e segurança.' },
                { num: '03', icon: Eye, title: 'Receba recomendações acionáveis', desc: 'Visualize resultados e aplique correções com orientação clara.' },
              ].map((step) => (
                <div key={step.num} className="text-center relative">
                  <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-card border border-border/50 mb-6 relative z-10">
                    <span className="text-2xl font-heading font-bold text-primary">{step.num}</span>
                  </div>
                  <h3 className="font-heading font-semibold text-foreground mb-2">{step.title}</h3>
                  <p className="text-sm text-muted-foreground max-w-xs mx-auto">{step.desc}</p>
                </div>
              ))}
            </div>
          </section>
        </SectionReveal>

        {/* ═══ PLATFORM PREVIEW ═══ */}
        <SectionReveal>
          <section className="max-w-[1200px] mx-auto px-6 py-16 lg:py-24">
            <div className="text-center mb-12">
              <h2 className="font-heading text-3xl lg:text-4xl font-semibold mb-4">
                Visibilidade completa
              </h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Interface moderna e intuitiva para monitorar toda sua infraestrutura.
              </p>
            </div>
            <div className="glass-container glow-border rounded-2xl overflow-hidden max-w-4xl mx-auto">
              <img
                src={dashboardPreview}
                alt="Interface da plataforma iScope 360"
                className="w-full h-auto"
                loading="lazy"
              />
            </div>
          </section>
        </SectionReveal>

        {/* ═══ SECURITY & TRUST ═══ */}
        <SectionReveal>
          <section id="security" className="max-w-[1200px] mx-auto px-6 py-16 lg:py-24">
            <div className="text-center mb-12">
              <h2 className="font-heading text-3xl lg:text-4xl font-semibold mb-4">
                Segurança em primeiro lugar
              </h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Projetado para atender os mais altos padrões de segurança corporativa.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-3xl mx-auto">
              {[
                { icon: Zap, title: 'Análise automatizada', desc: 'Varredura completa sem intervenção manual.' },
                { icon: AlertTriangle, title: 'Detecção de configurações inseguras', desc: 'Identifica problemas antes que se tornem incidentes.' },
                { icon: Shield, title: 'Boas práticas de segurança', desc: 'Baseado em frameworks reconhecidos do mercado.' },
                { icon: Lock, title: 'Visibilidade da infraestrutura', desc: 'Painel unificado com visão 360° do seu ambiente.' },
              ].map((item) => (
                <div key={item.title} className="feature-card flex gap-4 items-start">
                  <div className="shrink-0 p-2.5 rounded-lg bg-primary/10">
                    <item.icon className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-heading font-semibold text-foreground mb-1">{item.title}</h3>
                    <p className="text-sm text-muted-foreground">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </SectionReveal>

        {/* ═══ CTA ═══ */}
        <SectionReveal>
          <section className="max-w-[1200px] mx-auto px-6 py-16 lg:py-24">
            <div className="cta-gradient rounded-2xl border border-primary/20 px-8 py-16 lg:py-20 text-center">
              <h2 className="font-heading text-3xl lg:text-4xl font-bold mb-4">
                Comece a analisar sua infraestrutura hoje
              </h2>
              <p className="text-muted-foreground max-w-xl mx-auto mb-8">
                Descubra vulnerabilidades, melhore sua postura de segurança e mantenha compliance contínuo.
              </p>
              <Button size="lg" onClick={() => navigate('/auth')} className="gap-2 px-10 h-14 text-base">
                Acessar Plataforma <ArrowRight className="w-5 h-5" />
              </Button>
            </div>
          </section>
        </SectionReveal>
      </main>

      {/* ═══ FOOTER ═══ */}
      <footer className="relative z-10 border-t border-border/30">
        <div className="max-w-[1200px] mx-auto px-6 py-10 flex flex-col md:flex-row items-center justify-between gap-6">
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} Precisio Analytics. Todos os direitos reservados.
          </p>
          <div className="flex gap-8">
            {['Produto', 'Documentação', 'Segurança', 'Contato'].map((link) => (
              <a key={link} href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
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
