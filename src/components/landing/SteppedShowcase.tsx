import { useRef, useMemo } from 'react';
import { motion, useScroll, useTransform, useMotionValueEvent } from 'framer-motion';
import { useState } from 'react';
import { CheckCircle2 } from 'lucide-react';

/* ── Step data ── */
const steps = [
  {
    num: '01',
    title: 'Identifique as vulnerabilidades\nque realmente importam',
    description:
      'Identifique as poucas vulnerabilidades verdadeiramente críticas, para que você pare de se preocupar com uma vulnerabilidade não corrigida levando a um breach.',
  },
  {
    num: '02',
    title: 'Priorize com inteligência\ncontextual',
    description:
      'Correlacione dados de firewalls, cloud e endpoints para priorizar com base no risco real — não apenas no CVSS score.',
  },
  {
    num: '03',
    title: 'Responda rápido e pare\nde gerenciar remediação',
    description:
      'Use workflows inteligentes para preparar mitigações imediatas para vulnerabilidades críticas, com opções de remediação em um clique.',
  },
];

/* ── Floating CVE Card ── */
function CVECard({
  cve,
  x,
  y,
  opacity,
  scale,
  size = 'lg',
}: {
  cve: string;
  x: string;
  y: string;
  opacity: number;
  scale: number;
  size?: 'lg' | 'sm';
}) {
  const isSmall = size === 'sm';
  return (
    <motion.div
      className="absolute glass-container rounded-xl"
      style={{
        left: x,
        top: y,
        opacity,
        scale,
        padding: isSmall ? '10px 16px' : '14px 22px',
      }}
    >
      <div className="flex items-center gap-2 mb-2">
        <div className="relative">
          <div className={`${isSmall ? 'w-2 h-2' : 'w-3 h-3'} rounded-full border border-destructive/40 flex items-center justify-center`}>
            <div className={`${isSmall ? 'w-1 h-1' : 'w-1.5 h-1.5'} rounded-full bg-destructive animate-pulse`} />
          </div>
        </div>
        <span className={`font-mono ${isSmall ? 'text-xs text-foreground/60' : 'text-sm text-foreground/90'}`}>{cve}</span>
      </div>
      <div className="flex gap-2">
        {['Exploitable', 'High Likelihood', 'Critical Impact'].map((tag) => (
          <span
            key={tag}
            className={`font-mono tracking-wide ${isSmall ? 'text-[8px] text-destructive/50' : 'text-[10px] text-destructive/80'}`}
          >
            {tag}
          </span>
        ))}
      </div>
    </motion.div>
  );
}

/* ── Sankey-like Chart (step 2 visual) ── */
function SankeyChart({ opacity }: { opacity: number }) {
  const rows = [
    { label: 'Low', count: '380,431', color: 'hsl(var(--warning))', barWidth: '95%' },
    { label: 'Medium', count: '149,156', color: 'hsl(var(--info))', barWidth: '72%' },
    { label: 'High', count: '100,455', color: 'hsl(var(--primary))', barWidth: '48%' },
    { label: 'Critical', count: '89,186', color: 'hsl(var(--destructive))', barWidth: '38%' },
  ];

  return (
    <motion.div
      className="absolute right-[5%] top-[10%] glass-container rounded-2xl p-6 w-[380px]"
      style={{ opacity }}
    >
      <div className="space-y-4">
        {rows.map((row, i) => (
          <motion.div
            key={row.label}
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: opacity > 0.3 ? 1 : 0, x: opacity > 0.3 ? 0 : 30 }}
            transition={{ duration: 0.6, delay: i * 0.12, ease: [0.22, 1, 0.36, 1] }}
            className="flex items-center gap-3"
          >
            <div className="w-16 text-right">
              <div className="text-[11px] text-muted-foreground">{row.label}</div>
              <div className="font-mono text-xs text-foreground/70">{row.count}</div>
            </div>
            <div className="flex-1 h-6 rounded-sm bg-muted/20 overflow-hidden relative">
              <motion.div
                className="h-full rounded-sm"
                style={{ background: `linear-gradient(90deg, ${row.color}66, ${row.color}22)`, width: row.barWidth }}
                initial={{ scaleX: 0 }}
                animate={{ scaleX: opacity > 0.3 ? 1 : 0 }}
                transition={{ duration: 0.8, delay: 0.2 + i * 0.12, ease: [0.22, 1, 0.36, 1] }}
              />
              {/* Flowing curves overlay */}
              <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
                <motion.path
                  d={`M 0 ${12} Q ${50 + i * 10} ${4 + i * 3}, 100% ${8 + i * 2}`}
                  stroke={row.color}
                  strokeWidth="1.5"
                  fill="none"
                  opacity="0.4"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: opacity > 0.3 ? 1 : 0 }}
                  transition={{ duration: 1.2, delay: 0.4 + i * 0.1 }}
                />
              </svg>
            </div>
          </motion.div>
        ))}
      </div>
      {/* Right side label */}
      <div className="absolute -right-8 top-0 bottom-0 flex flex-col justify-between text-[9px] font-mono text-muted-foreground/50 writing-vertical">
        <span>Exploitable 10%</span>
        <span>Not Exploitable 90%</span>
      </div>
    </motion.div>
  );
}

/* ── Workflow Step ── */
function WorkflowStepCard({
  num,
  label,
  visible,
  delay = 0,
}: {
  num: string;
  label: string;
  visible: boolean;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: visible ? 1 : 0, y: visible ? 0 : 20 }}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
      className="glass-container px-6 py-4 rounded-xl flex items-center gap-4"
    >
      <div className="flex-shrink-0 w-10 h-10 rounded-full border border-dashed border-muted-foreground/30 flex items-center justify-center">
        <span className="font-mono text-sm text-muted-foreground">{num}.</span>
      </div>
      <span className="text-sm text-foreground/80 flex-1">{label}</span>
      <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />
    </motion.div>
  );
}

/* ── Progress Bar ── */
function ProgressBar({ scrollProgress }: { scrollProgress: number }) {
  // Map scroll progress to step: 0-0.33 = step 0, 0.33-0.66 = step 1, 0.66-1 = step 2
  const step1Start = 0;
  const step2Start = 1 / 3;
  const step3Start = 2 / 3;

  const getSegmentProgress = (segStart: number, segEnd: number) => {
    if (scrollProgress <= segStart) return 0;
    if (scrollProgress >= segEnd) return 1;
    return (scrollProgress - segStart) / (segEnd - segStart);
  };

  const seg1 = getSegmentProgress(step1Start, step2Start);
  const seg2 = getSegmentProgress(step2Start, step3Start);

  // Dot position: which segment it's in
  const dotLeft = useMemo(() => {
    if (scrollProgress < step2Start) {
      return `${(scrollProgress / step2Start) * 47}%`;
    } else if (scrollProgress < step3Start) {
      return `${50 + ((scrollProgress - step2Start) / (step3Start - step2Start)) * 47}%`;
    } else {
      return '97%';
    }
  }, [scrollProgress]);

  return (
    <div className="sticky top-0 z-30 pt-4 pb-6 bg-gradient-to-b from-background via-background to-transparent">
      <div className="flex items-center w-full max-w-[1200px] mx-auto px-6">
        {steps.map((s, i) => {
          const isActive = scrollProgress >= i / 3;
          return (
            <div key={s.num} className="flex items-center flex-1">
              <span
                className={`font-mono text-sm transition-colors duration-500 ${
                  isActive ? 'text-foreground' : 'text-muted-foreground/30'
                }`}
              >
                {s.num}
              </span>
              {i < steps.length - 1 && (
                <div className="flex-1 mx-3 h-px relative">
                  <div className="absolute inset-0 bg-muted-foreground/10" />
                  <div
                    className="absolute inset-y-0 left-0 h-px transition-all duration-300 ease-out"
                    style={{
                      width: `${(i === 0 ? seg1 : seg2) * 100}%`,
                      background: 'linear-gradient(90deg, hsl(var(--primary) / 0.5), hsl(var(--primary) / 0.15))',
                    }}
                  />
                  {/* Dotted line */}
                  <div className="absolute inset-0 flex items-center">
                    {Array.from({ length: 30 }).map((_, j) => (
                      <div
                        key={j}
                        className="w-[2px] h-[2px] rounded-full mx-[3px]"
                        style={{
                          backgroundColor:
                            j / 30 <= (i === 0 ? seg1 : seg2)
                              ? 'hsl(var(--primary) / 0.4)'
                              : 'hsl(var(--muted-foreground) / 0.15)',
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {/* Moving dot */}
        <div
          className="absolute w-3 h-3 rounded-full bg-primary shadow-lg shadow-primary/50 transition-all duration-300 ease-out"
          style={{
            left: dotLeft,
            top: '50%',
            transform: 'translate(-50%, -50%)',
          }}
        />
      </div>
    </div>
  );
}

/* ── Main Component ── */
export function SteppedShowcase() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [currentProgress, setCurrentProgress] = useState(0);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end end'],
  });

  useMotionValueEvent(scrollYProgress, 'change', (v) => {
    setCurrentProgress(v);
  });

  // Determine active step from scroll
  const activeStep = currentProgress < 0.33 ? 0 : currentProgress < 0.66 ? 1 : 2;

  // Per-step opacity for smooth crossfade
  const step0Opacity = currentProgress < 0.25 ? 1 : currentProgress < 0.38 ? 1 - (currentProgress - 0.25) / 0.13 : 0;
  const step1Opacity = currentProgress < 0.25 ? 0 : currentProgress < 0.38 ? (currentProgress - 0.25) / 0.13 : currentProgress < 0.58 ? 1 : currentProgress < 0.71 ? 1 - (currentProgress - 0.58) / 0.13 : 0;
  const step2Opacity = currentProgress < 0.58 ? 0 : currentProgress < 0.71 ? (currentProgress - 0.58) / 0.13 : 1;

  return (
    <section ref={containerRef} className="relative" style={{ height: '300vh' }}>
      {/* Particle background */}
      <div className="absolute inset-0 animated-grid-dots grid-radial-mask opacity-60" />

      <div className="sticky top-0 h-screen overflow-hidden flex flex-col">
        <ProgressBar scrollProgress={currentProgress} />

        <div className="flex-1 flex items-center">
          <div className="max-w-[1200px] mx-auto px-6 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center w-full">
            {/* Left: Text — crossfade between steps */}
            <div className="relative min-h-[280px]">
              {steps.map((step, i) => {
                const opacity = i === 0 ? step0Opacity : i === 1 ? step1Opacity : step2Opacity;
                return (
                  <motion.div
                    key={i}
                    className="absolute inset-0 flex flex-col justify-center"
                    style={{ opacity, pointerEvents: opacity > 0.5 ? 'auto' : 'none' }}
                  >
                    <h2 className="font-heading text-3xl lg:text-[2.75rem] font-bold leading-tight text-foreground whitespace-pre-line mb-6">
                      {step.title}
                    </h2>
                    <p className="text-muted-foreground text-lg leading-relaxed max-w-md">
                      {step.description}
                    </p>
                  </motion.div>
                );
              })}
            </div>

            {/* Right: Visuals — crossfade */}
            <div className="relative h-[450px]">
              {/* Step 0: CVE Cards floating */}
              <div style={{ opacity: step0Opacity, pointerEvents: step0Opacity > 0.3 ? 'auto' : 'none' }} className="absolute inset-0">
                <CVECard cve="CVE-2025-21613" x="15%" y="8%" opacity={step0Opacity} scale={step0Opacity} />
                <CVECard cve="CVE-2024-53990" x="25%" y="38%" opacity={step0Opacity} scale={step0Opacity} size="lg" />
                <CVECard cve="CVE-2024-53194" x="30%" y="58%" opacity={step0Opacity} scale={step0Opacity} size="sm" />
              </div>

              {/* Step 1: Sankey chart */}
              <div style={{ opacity: step1Opacity, pointerEvents: step1Opacity > 0.3 ? 'auto' : 'none' }} className="absolute inset-0">
                <SankeyChart opacity={step1Opacity} />
              </div>

              {/* Step 2: Workflow */}
              <div
                style={{ opacity: step2Opacity, pointerEvents: step2Opacity > 0.3 ? 'auto' : 'none' }}
                className="absolute inset-0 flex flex-col justify-center gap-3 max-w-md ml-auto"
              >
                <motion.div
                  className="glass-container px-5 py-3 rounded-xl mb-2"
                  style={{ opacity: step2Opacity }}
                >
                  <div className="font-mono text-sm text-foreground/90 mb-2">CVE-2024-53194</div>
                  <div className="flex gap-2">
                    {['Exploitable', 'High Likelihood', 'Critical Impact'].map((t) => (
                      <span key={t} className="text-[10px] font-mono text-destructive/80">{t}</span>
                    ))}
                  </div>
                </motion.div>
                <WorkflowStepCard num="01" label="Incidente criado" visible={step2Opacity > 0.5} delay={0.1} />
                <WorkflowStepCard num="02" label="Política WAF implantada" visible={step2Opacity > 0.5} delay={0.2} />
                <WorkflowStepCard num="03" label="Ticket criado" visible={step2Opacity > 0.5} delay={0.3} />
                <WorkflowStepCard num="04" label="Notificação enviada para #segurança" visible={step2Opacity > 0.5} delay={0.4} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
