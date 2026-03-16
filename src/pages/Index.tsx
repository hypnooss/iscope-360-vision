import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Header } from '@/components/Header';
import { NetworkAnimation } from '@/components/NetworkAnimation';
import { Button } from '@/components/ui/button';
import {
  ArrowRight, Shield, Network, Eye, Zap, ChevronDown,
  Quote, Scan, BarChart3, FileSearch, ShieldCheck,
  AlertTriangle, Clock, Layers, BookOpen, CheckCircle2, Lock,
  BellOff, SlidersHorizontal, Puzzle, Calendar, Tag,
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
              <Button
                size="lg"
                variant="outline"
                onClick={() => document.querySelector('#how-it-works')?.scrollIntoView({ behavior: 'smooth' })}
                className="gap-2 h-14 px-14 text-lg font-semibold"
              >
                Ver como funciona
              </Button>
            </SectionReveal>
          </div>

          {/* Scroll indicator */}
          <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-muted-foreground/40">
            <span className="text-[10px] uppercase tracking-[0.3em] font-mono">Scroll</span>
            <ChevronDown className="w-4 h-4 animate-bounce" />
          </div>
        </section>

        {/* ═══ PROBLEM — Impact Numbers (2025 data) ═══ */}
        <section id="problem" className="min-h-screen flex items-center justify-center px-6">
          <div className="max-w-[1100px] mx-auto w-full">
            <SectionReveal>
              <div className="text-center mb-20">
                <h2 className="font-heading text-3xl lg:text-[2.5rem] font-bold mb-6 leading-tight">
                  A superfície de ataque{' '}
                  <span className="text-primary">nunca foi tão grande</span>
                </h2>
                <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
                  Em 2025, o volume de vulnerabilidades e a velocidade de exploração atingiram níveis sem precedentes.
                </p>
              </div>
            </SectionReveal>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-12 md:gap-8">
              {[
                { number: '21,500', suffix: '+', context: 'CVEs no 1º semestre de 2025', subtext: 'Projeção de 45.000+ no ano — recorde absoluto' },
                { number: '5', suffix: ' dias', context: 'Tempo médio para exploração', subtext: 'Colapsou de 63 dias em 2019 para 5 em 2023' },
                { number: '$4.88', suffix: 'M', context: 'Custo médio de um data breach', subtext: 'IBM Cost of a Data Breach Report 2024' },
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

        {/* ═══ THE REAL PROBLEM — False Positives ═══ */}
        <section className="min-h-screen flex items-center justify-center px-6 bg-background/60">
          <div className="max-w-[1100px] mx-auto w-full">
            <SectionReveal>
              <div className="text-center mb-6">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-destructive/20 bg-destructive/5 text-destructive text-xs font-mono uppercase tracking-wider mb-8">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  O problema real
                </div>
                <h2 className="font-heading text-3xl lg:text-[2.5rem] font-bold mb-6 leading-tight">
                  <span className="text-primary">90%</span> dos alertas são falsos positivos
                </h2>
                <p className="text-muted-foreground max-w-2xl mx-auto text-lg leading-relaxed">
                  Ferramentas tradicionais inundam sua equipe com milhares de alertas sem contexto.
                  O resultado? Fadiga de alertas, priorização errada e riscos reais ignorados.
                </p>
              </div>
            </SectionReveal>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16">
              {[
                {
                  icon: BellOff,
                  title: 'Alertas sem contexto',
                  description: 'Scanners reportam vulnerabilidades sem considerar sua infraestrutura, ambiente ou controles compensatórios.',
                  stat: '25h/semana',
                  statLabel: 'gastas em triagem manual',
                },
                {
                  icon: SlidersHorizontal,
                  title: 'Priorização manual',
                  description: 'Sem automação, equipes dependem de planilhas e intuição para decidir o que corrigir primeiro.',
                  stat: '68%',
                  statLabel: 'das equipes não conseguem priorizar',
                },
                {
                  icon: Puzzle,
                  title: 'Ferramentas fragmentadas',
                  description: 'Firewalls, cloud, endpoints — cada um com seu painel. Nenhuma visão unificada do risco real.',
                  stat: '6+',
                  statLabel: 'ferramentas por equipe em média',
                },
              ].map((item, i) => (
                <SectionReveal key={item.title} delay={i * 120}>
                  <div className="glass-container p-8 h-full flex flex-col group">
                    <div className="inline-flex p-3 rounded-xl bg-destructive/10 mb-5 self-start group-hover:bg-destructive/15 transition-colors duration-300">
                      <item.icon className="w-5 h-5 text-destructive" />
                    </div>
                    <h3 className="font-heading font-bold text-lg text-foreground mb-3">{item.title}</h3>
                    <p className="text-[15px] text-muted-foreground leading-relaxed flex-1 mb-6">{item.description}</p>
                    <div className="border-t border-border/20 pt-4">
                      <div className="text-2xl font-heading font-extrabold text-foreground">{item.stat}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{item.statLabel}</div>
                    </div>
                  </div>
                </SectionReveal>
              ))}
            </div>
          </div>
        </section>

        {/* ═══ SOLUTION — 4-Step Flow ═══ */}
        <section id="how-it-works" className="min-h-screen flex items-center justify-center px-6">
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
        <section id="features" className="min-h-screen flex items-center justify-center px-6 bg-background/60">
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

        {/* ═══ FRAMEWORKS & COMPLIANCE ═══ */}
        <section className="min-h-screen flex items-center justify-center px-6">
          <div className="max-w-[1100px] mx-auto w-full">
            <SectionReveal>
              <div className="text-center mb-16">
                <h2 className="font-heading text-3xl lg:text-[2.5rem] font-bold mb-4">
                  Conformidade com os principais{' '}
                  <span className="text-primary">frameworks</span>
                </h2>
                <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
                  Verifique automaticamente a aderência da sua infraestrutura aos padrões mais exigentes do mercado.
                </p>
              </div>
            </SectionReveal>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
              {[
                { name: 'CIS Benchmarks', desc: 'Hardening de sistemas e dispositivos de rede', icon: Shield },
                { name: 'NIST CSF', desc: 'Framework de cibersegurança do governo dos EUA', icon: Layers },
                { name: 'ISO 27001', desc: 'Gestão de segurança da informação', icon: CheckCircle2 },
                { name: 'PCI DSS', desc: 'Segurança de dados de cartões de pagamento', icon: Lock },
                { name: 'SOC 2', desc: 'Controles de segurança, disponibilidade e privacidade', icon: ShieldCheck },
                { name: 'LGPD', desc: 'Lei Geral de Proteção de Dados brasileira', icon: FileSearch },
              ].map((fw, i) => (
                <SectionReveal key={fw.name} delay={i * 80}>
                  <div className="glass-container p-6 md:p-8 text-center group hover:border-primary/30 transition-colors duration-300">
                    <div className="inline-flex p-3 rounded-xl bg-primary/10 mb-4 group-hover:bg-primary/15 transition-colors duration-300">
                      <fw.icon className="w-5 h-5 text-primary" />
                    </div>
                    <h3 className="font-heading font-bold text-foreground text-sm md:text-base mb-1">{fw.name}</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">{fw.desc}</p>
                  </div>
                </SectionReveal>
              ))}
            </div>
          </div>
        </section>

        {/* ═══ TESTIMONIALS ═══ */}
        <section className="min-h-screen flex items-center justify-center px-6 bg-background/60">
          <div className="max-w-[1100px] mx-auto w-full">
            <SectionReveal>
              <div className="text-center mb-16">
                <h2 className="font-heading text-3xl lg:text-[2.5rem] font-bold mb-4">
                  O que nossos <span className="text-primary">clientes</span> dizem
                </h2>
                <p className="text-muted-foreground max-w-xl mx-auto text-lg">
                  Empresas de diferentes setores confiam no iScope para proteger sua operação.
                </p>
              </div>
            </SectionReveal>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                {
                  quote: 'Reduzimos nosso tempo de auditoria de compliance em 65%. O que levava uma semana agora é feito em um dia com o iScope.',
                  name: 'Carlos M.',
                  role: 'CISO',
                  company: 'Empresa de Tecnologia — 2.000+ funcionários',
                },
                {
                  quote: 'Pela primeira vez temos visibilidade real do nosso ambiente multi-cloud. Antes eram 6 ferramentas e nenhuma visão unificada.',
                  name: 'Ana L.',
                  role: 'CTO',
                  company: 'Fintech — Série B',
                },
                {
                  quote: 'A detecção automática de configurações inseguras nos evitou dois incidentes críticos em seis meses. O ROI se pagou no primeiro trimestre.',
                  name: 'Roberto S.',
                  role: 'Diretor de Infraestrutura',
                  company: 'Healthcare — 50+ unidades',
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
                      <div className="text-xs text-muted-foreground/60 mt-0.5">{t.company}</div>
                    </div>
                  </div>
                </SectionReveal>
              ))}
            </div>
          </div>
        </section>

        {/* ═══ BLOG / INSIGHTS ═══ */}
        <section id="blog" className="min-h-screen flex items-center justify-center px-6">
          <div className="max-w-[1100px] mx-auto w-full">
            <SectionReveal>
              <div className="text-center mb-16">
                <h2 className="font-heading text-3xl lg:text-[2.5rem] font-bold mb-4">
                  Insights de <span className="text-primary">segurança</span>
                </h2>
                <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
                  Análises e perspectivas sobre o cenário atual de cibersegurança e compliance.
                </p>
              </div>
            </SectionReveal>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                {
                  category: 'Security',
                  date: 'Mar 2025',
                  title: '2025: O ano que vulnerabilidades quebraram todos os recordes',
                  excerpt: 'Com 21.500+ CVEs só no primeiro semestre, entenda por que a abordagem tradicional de patch management não escala mais.',
                },
                {
                  category: 'Product',
                  date: 'Fev 2025',
                  title: 'Por que CVSS sozinho não é suficiente para priorizar vulnerabilidades',
                  excerpt: 'Contexto de negócio, exposição e controles compensatórios: os fatores que o CVSS ignora na priorização de riscos.',
                },
                {
                  category: 'Compliance',
                  date: 'Jan 2025',
                  title: 'Compliance não é segurança: por que checklist não funciona',
                  excerpt: 'A diferença entre estar em conformidade no papel e ter uma postura de segurança efetiva contra ameaças reais.',
                },
              ].map((post, i) => (
                <SectionReveal key={post.title} delay={i * 120}>
                  <div className="glass-container p-8 h-full flex flex-col group cursor-pointer hover:border-primary/30 transition-colors duration-300">
                    <div className="flex items-center gap-3 mb-5">
                      <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.2em] font-mono text-primary/70">
                        <Tag className="w-3 h-3" />
                        {post.category}
                      </span>
                      <span className="text-[10px] text-muted-foreground/50 font-mono flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {post.date}
                      </span>
                    </div>
                    <h3 className="font-heading font-bold text-lg text-foreground mb-3 group-hover:text-primary transition-colors duration-300 leading-snug">
                      {post.title}
                    </h3>
                    <p className="text-[14px] text-muted-foreground leading-relaxed flex-1 mb-5">
                      {post.excerpt}
                    </p>
                    <div className="flex items-center gap-1.5 text-xs font-medium text-primary/70 group-hover:text-primary transition-colors duration-300">
                      Ler artigo <ArrowRight className="w-3.5 h-3.5" />
                    </div>
                  </div>
                </SectionReveal>
              ))}
            </div>
          </div>
        </section>

        {/* ═══ CTA FINAL ═══ */}
        <section id="cta" className="min-h-screen flex items-center justify-center px-6 relative overflow-hidden">
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
            {[
              { label: 'Produto', href: '#features' },
              { label: 'Documentação', href: '#blog' },
              { label: 'Segurança', href: '#problem' },
              { label: 'Contato', href: '#cta' },
            ].map((link) => (
              <button
                key={link.href}
                onClick={() => document.querySelector(link.href)?.scrollIntoView({ behavior: 'smooth' })}
                className="text-sm text-muted-foreground/60 hover:text-foreground transition-colors duration-200"
              >
                {link.label}
              </button>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
