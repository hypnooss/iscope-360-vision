import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Header } from '@/components/Header';
import { NetworkAnimation } from '@/components/NetworkAnimation';
import { Button } from '@/components/ui/button';
import {
  ArrowRight, Shield, Network, Eye, Zap, ChevronDown,
  Quote, Scan, BarChart3, FileSearch, ShieldCheck,
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

/* ── Animated Counter ── */
function AnimatedNumber({ value, suffix = '' }: { value: string; suffix?: string }) {
  return (
    <span className="tabular-nums">
      {value}<span className="text-primary">{suffix}</span>
    </span>
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
      <NetworkAnimation />
      <div className="pointer-events-none fixed inset-0 z-0 animated-grid-dots grid-radial-mask" />

      <Header />

      <main className="flex-1 relative z-10">
        {/* ═══ HERO ═══ */}
        <section className="min-h-screen flex flex-col items-center justify-center px-6 relative">
          <div className="text-center max-w-4xl mx-auto">
            <SectionReveal delay={100}>
              <p className="text-xs uppercase tracking-[0.3em] text-primary/70 font-medium mb-8 font-mono">
                Plataforma de Segurança &amp; Compliance
              </p>
            </SectionReveal>

            <SectionReveal delay={200}>
              <h1 className="font-heading text-[2.75rem] sm:text-[3.5rem] lg:text-[4.5rem] font-extrabold leading-[1.05] tracking-tight mb-8">
                Gerencie sua infraestrutura{' '}
                <span className="text-primary">com inteligência</span>
              </h1>
            </SectionReveal>

            <SectionReveal delay={300}>
              <p className="text-lg lg:text-xl text-muted-foreground max-w-2xl mx-auto mb-14 leading-relaxed">
                Plataforma completa para análise de compliance, segurança e
                boas práticas da sua infraestrutura.
              </p>
            </SectionReveal>

            <SectionReveal delay={400}>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button
                  size="lg"
                  onClick={() => navigate('/auth')}
                  className="gap-2 h-13 px-10 text-base font-semibold shadow-[0_0_30px_hsl(175_80%_45%/0.2)] hover:shadow-[0_0_50px_hsl(175_80%_45%/0.35)] transition-shadow duration-300"
                >
                  Acessar Plataforma <ArrowRight className="w-5 h-5" />
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={() => document.querySelector('#how-it-works')?.scrollIntoView({ behavior: 'smooth' })}
                  className="gap-2 h-13 px-10 text-base font-semibold"
                >
                  Ver como funciona
                </Button>
              </div>
            </SectionReveal>
          </div>

          {/* Scroll indicator */}
          <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-muted-foreground/40">
            <span className="text-[10px] uppercase tracking-[0.3em] font-mono">Scroll</span>
            <ChevronDown className="w-4 h-4 animate-bounce" />
          </div>
        </section>

        {/* ═══ PROBLEM — Impact Numbers ═══ */}
        <section className="min-h-screen flex items-center justify-center px-6">
          <div className="max-w-[1100px] mx-auto w-full">
            <SectionReveal>
              <div className="text-center mb-20">
                <h2 className="font-heading text-3xl lg:text-[2.5rem] font-bold mb-6 leading-tight">
                  Backlogs de vulnerabilidades{' '}
                  <span className="text-primary">continuam crescendo</span>
                </h2>
                <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
                  A cada dia novas ameaças surgem. Manter a visibilidade e o controle da sua infraestrutura não é mais opcional.
                </p>
              </div>
            </SectionReveal>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-12 md:gap-8">
              {[
                { number: '40,000', suffix: '+', context: 'Vulnerabilidades publicadas em 2024', subtext: 'CVEs registrados — recorde histórico' },
                { number: '72', suffix: 'h', context: 'Tempo médio para exploração', subtext: 'Após a publicação de um CVE crítico' },
                { number: '34', suffix: '%', context: 'Aumento em ataques a infraestrutura', subtext: 'Em relação ao ano anterior' },
              ].map((stat, i) => (
                <SectionReveal key={stat.context} delay={i * 150}>
                  <div className="text-center md:text-left">
                    <div className="text-5xl lg:text-6xl font-heading font-extrabold text-foreground mb-3 tracking-tight">
                      <AnimatedNumber value={stat.number} suffix={stat.suffix} />
                    </div>
                    <div className="text-lg font-semibold text-foreground/90 mb-1">{stat.context}</div>
                    <div className="text-sm text-muted-foreground">{stat.subtext}</div>
                  </div>
                </SectionReveal>
              ))}
            </div>
          </div>
        </section>

        {/* ═══ SOLUTION — 4-Step Flow ═══ */}
        <section id="how-it-works" className="min-h-screen flex items-center justify-center px-6 bg-card/20">
          <div className="max-w-[1100px] mx-auto w-full">
            <SectionReveal>
              <div className="text-center mb-20">
                <h2 className="font-heading text-3xl lg:text-[2.5rem] font-bold mb-4">
                  Como o iScope <span className="text-primary">resolve</span>
                </h2>
                <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
                  Da conexão à ação — em quatro passos simples.
                </p>
              </div>
            </SectionReveal>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 relative">
              {/* Connecting line */}
              <div className="hidden md:block absolute top-16 left-[12%] right-[12%] h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />

              {[
                { num: '01', icon: Network, title: 'Conecte', desc: 'Integre firewalls, servidores e serviços de nuvem em minutos.' },
                { num: '02', icon: Scan, title: 'Analise', desc: 'Nossa engine avalia centenas de pontos de compliance e segurança.' },
                { num: '03', icon: BarChart3, title: 'Visualize', desc: 'Dashboards interativos com visão 360° do seu ambiente.' },
                { num: '04', icon: ShieldCheck, title: 'Corrija', desc: 'Recomendações acionáveis para melhorar sua postura de segurança.' },
              ].map((step, i) => (
                <SectionReveal key={step.num} delay={i * 120}>
                  <div className="text-center relative">
                    <div className="inline-flex items-center justify-center w-[4.5rem] h-[4.5rem] rounded-2xl bg-card border border-border/40 mb-6 relative z-10 shadow-lg shadow-background/50">
                      <step.icon className="w-6 h-6 text-primary" />
                    </div>
                    <div className="text-xs font-mono text-primary/60 mb-2 tracking-wider">{step.num}</div>
                    <h3 className="font-heading font-bold text-lg text-foreground mb-2">{step.title}</h3>
                    <p className="text-sm text-muted-foreground max-w-[220px] mx-auto leading-relaxed">{step.desc}</p>
                  </div>
                </SectionReveal>
              ))}
            </div>
          </div>
        </section>

        {/* ═══ FEATURES — Showcases ═══ */}
        <section id="features" className="min-h-screen flex items-center justify-center px-6">
          <div className="max-w-[1100px] mx-auto w-full">
            <SectionReveal>
              <div className="text-center mb-16">
                <h2 className="font-heading text-3xl lg:text-[2.5rem] font-bold mb-4">
                  Tudo que você precisa em <span className="text-primary">um só lugar</span>
                </h2>
                <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
                  Ferramentas poderosas para manter sua infraestrutura segura e em conformidade.
                </p>
              </div>
            </SectionReveal>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                {
                  icon: FileSearch,
                  title: 'Análise de Compliance',
                  description: 'Mais de 50 pontos de verificação baseados em boas práticas de mercado e frameworks reconhecidos.',
                  highlight: '50+ verificações',
                },
                {
                  icon: Shield,
                  title: 'Detecção de Riscos',
                  description: 'Identifica vulnerabilidades e configurações inseguras automaticamente em toda a sua infraestrutura.',
                  highlight: 'Tempo real',
                },
                {
                  icon: Eye,
                  title: 'Visibilidade Total',
                  description: 'Dashboards unificados com visão 360° do ambiente — firewalls, cloud, endpoints e serviços.',
                  highlight: 'Visão 360°',
                },
              ].map((f, i) => (
                <SectionReveal key={f.title} delay={i * 100}>
                  <div className="feature-card group h-full flex flex-col">
                    <div className="inline-flex p-3.5 rounded-xl bg-primary/10 mb-5 group-hover:bg-primary/15 transition-colors duration-300 self-start">
                      <f.icon className="w-6 h-6 text-primary" />
                    </div>
                    <div className="text-[10px] uppercase tracking-[0.2em] text-primary/60 font-mono mb-3">{f.highlight}</div>
                    <h3 className="font-heading font-bold text-xl text-foreground mb-3">{f.title}</h3>
                    <p className="text-[15px] text-muted-foreground leading-relaxed flex-1">{f.description}</p>
                  </div>
                </SectionReveal>
              ))}
            </div>
          </div>
        </section>

        {/* ═══ TESTIMONIALS ═══ */}
        <section className="min-h-screen flex items-center justify-center px-6 bg-card/20">
          <div className="max-w-[1100px] mx-auto w-full">
            <SectionReveal>
              <div className="text-center mb-16">
                <h2 className="font-heading text-3xl lg:text-[2.5rem] font-bold mb-4">
                  O que nossos <span className="text-primary">clientes</span> dizem
                </h2>
              </div>
            </SectionReveal>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                {
                  quote: 'O iScope reduziu nosso tempo de auditoria de compliance em mais de 60%. É indispensável para nossa operação.',
                  name: 'Carlos M.',
                  role: 'CISO — Empresa de Tecnologia',
                },
                {
                  quote: 'Finalmente conseguimos ter visibilidade real do nosso ambiente. Antes do iScope era tudo manual e fragmentado.',
                  name: 'Ana L.',
                  role: 'CTO — Fintech',
                },
                {
                  quote: 'A detecção automática de configurações inseguras já nos evitou dois incidentes graves em seis meses.',
                  name: 'Roberto S.',
                  role: 'Diretor de Infraestrutura — Healthcare',
                },
              ].map((t, i) => (
                <SectionReveal key={t.name} delay={i * 120}>
                  <div className="glass-container p-8 h-full flex flex-col">
                    <Quote className="w-8 h-8 text-primary/20 mb-4 shrink-0" />
                    <p className="text-[15px] text-foreground/80 leading-relaxed mb-8 flex-1 italic">
                      "{t.quote}"
                    </p>
                    <div className="border-t border-border/20 pt-5">
                      <div className="font-heading font-bold text-foreground text-sm">{t.name}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{t.role}</div>
                    </div>
                  </div>
                </SectionReveal>
              ))}
            </div>
          </div>
        </section>

        {/* ═══ CTA FINAL ═══ */}
        <section className="min-h-screen flex items-center justify-center px-6 relative overflow-hidden">
          {/* Subtle glow behind CTA */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-primary/5 blur-[120px] pointer-events-none" />

          <div className="max-w-3xl mx-auto w-full text-center relative z-10">
            <SectionReveal>
              <h2 className="font-heading text-3xl lg:text-[2.5rem] font-bold mb-6">
                Comece a proteger sua infraestrutura{' '}
                <span className="text-primary">hoje</span>
              </h2>
              <p className="text-muted-foreground max-w-xl mx-auto mb-12 text-lg leading-relaxed">
                Descubra vulnerabilidades, melhore sua postura de segurança e mantenha compliance contínuo.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button
                  size="lg"
                  onClick={() => navigate('/auth')}
                  className="gap-2 px-12 h-14 text-base font-semibold shadow-[0_0_40px_hsl(175_80%_45%/0.25)] hover:shadow-[0_0_60px_hsl(175_80%_45%/0.4)] transition-shadow duration-300 animate-pulse-glow"
                >
                  Acessar Plataforma <ArrowRight className="w-5 h-5" />
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={() => navigate('/auth')}
                  className="gap-2 px-10 h-14 text-base font-semibold"
                >
                  Falar com especialista
                </Button>
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
