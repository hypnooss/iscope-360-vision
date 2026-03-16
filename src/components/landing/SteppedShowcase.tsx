import { useRef } from 'react';
import { motion, useScroll, useTransform, useMotionValueEvent } from 'framer-motion';
import { useState } from 'react';
import { CheckCircle2, Search, Brain, Zap } from 'lucide-react';

/* ── Step data ── */
const steps = [
  {
    num: '01',
    badge: 'Identificação',
    icon: Search,
    title: 'Identifique as vulnerabilidades\nque realmente importam',
    description:
      'Identifique as poucas vulnerabilidades verdadeiramente críticas, para que você pare de se preocupar com uma vulnerabilidade não corrigida levando a um breach.',
  },
  {
    num: '02',
    badge: 'Priorização',
    icon: Brain,
    title: 'Priorize com inteligência\ncontextual',
    description:
      'Correlacione dados de firewalls, cloud e endpoints para priorizar com base no risco real — não apenas no CVSS score.',
  },
  {
    num: '03',
    badge: 'Remediação',
    icon: Zap,
    title: 'Responda rápido e pare\nde gerenciar remediação',
    description:
      'Use workflows inteligentes para preparar mitigações imediatas para vulnerabilidades críticas, com opções de remediação em um clique.',
  },
];

const EASE = [0.22, 1, 0.36, 1] as const;

/* ── Floating CVE Card ── */
function CVECard({
  cve,
  x,
  y,
  opacity,
  scale,
  rotate = 0,
  size = 'lg',
}: {
  cve: string;
  x: string;
  y: string;
  opacity: number;
  scale: number;
  rotate?: number;
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
        rotate,
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
      className="glass-container rounded-2xl p-6 w-full max-w-[380px] ml-auto"
      style={{ opacity }}
      initial={{ x: 60, scale: 0.95 }}
      animate={{ x: opacity > 0.3 ? 0 : 60, scale: opacity > 0.3 ? 1 : 0.95 }}
      transition={{ duration: 0.7, ease: EASE }}
    >
      <div className="text-xs font-mono text-muted-foreground/60 uppercase tracking-wider mb-4">Risk Distribution</div>
      <div className="space-y-4">
        {rows.map((row, i) => (
          <motion.div
            key={row.label}
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: opacity > 0.3 ? 1 : 0, x: opacity > 0.3 ? 0 : 30 }}
            transition={{ duration: 0.6, delay: i * 0.12, ease: EASE }}
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
                transition={{ duration: 0.8, delay: 0.2 + i * 0.12, ease: EASE }}
              />
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
      <div className="flex justify-between mt-4 text-[9px] font-mono text-muted-foreground/40">
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
      initial={{ opacity: 0, y: 30, scale: 0.9 }}
      animate={{ opacity: visible ? 1 : 0, y: visible ? 0 : 30, scale: visible ? 1 : 0.9 }}
      transition={{ duration: 0.6, delay, ease: EASE }}
      className="glass-container px-5 py-4 rounded-xl flex items-center gap-4"
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
  const totalProgress = Math.min(scrollProgress * 1.1, 1); // slightly accelerate fill

  return (
    <div className="sticky top-0 z-30 pt-6 pb-8 bg-gradient-to-b from-background via-background/95 to-transparent">
      <div className="flex items-start justify-center w-full max-w-[900px] mx-auto px-6">
        {steps.map((s, i) => {
          const stepStart = i / 3;
          const isActive = totalProgress >= stepStart;
          const isPast = totalProgress >= (i + 1) / 3;
          const Icon = s.icon;

          return (
            <div key={s.num} className="flex items-start flex-1">
              {/* Step node */}
              <div className="flex flex-col items-center gap-2 min-w-[80px]">
                <motion.div
                  className={`w-10 h-10 rounded-full border-2 flex items-center justify-center transition-all duration-500 ${
                    isActive
                      ? 'border-primary bg-primary/10 shadow-md shadow-primary/20'
                      : 'border-muted-foreground/20 bg-card'
                  }`}
                  animate={{ scale: isActive ? 1 : 0.85 }}
                  transition={{ duration: 0.4, ease: EASE }}
                >
                  <Icon className={`w-4 h-4 transition-colors duration-500 ${isActive ? 'text-primary' : 'text-muted-foreground/30'}`} />
                </motion.div>
                <div className="text-center">
                  <div className={`font-mono text-[11px] transition-colors duration-500 ${isActive ? 'text-foreground' : 'text-muted-foreground/30'}`}>
                    {s.num}
                  </div>
                  <div className={`text-[10px] transition-colors duration-500 ${isActive ? 'text-muted-foreground' : 'text-muted-foreground/20'}`}>
                    {s.badge}
                  </div>
                </div>
              </div>

              {/* Connector line */}
              {i < steps.length - 1 && (
                <div className="flex-1 mt-5 mx-2">
                  <div className="h-[2px] rounded-full bg-muted-foreground/10 relative overflow-hidden">
                    <motion.div
                      className="absolute inset-y-0 left-0 rounded-full"
                      style={{
                        background: 'linear-gradient(90deg, hsl(var(--primary)), hsl(var(--primary) / 0.3))',
                      }}
                      animate={{
                        width: isPast ? '100%' : isActive && !isPast ? `${((totalProgress - stepStart) / (1 / 3)) * 100}%` : '0%',
                      }}
                      transition={{ duration: 0.4, ease: 'easeOut' }}
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
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

  // Per-step opacity + translateY for smooth crossfade
  const getStepValues = (stepIndex: number) => {
    const enterStart = stepIndex === 0 ? 0 : stepIndex / 3 - 0.08;
    const enterEnd = stepIndex === 0 ? 0.05 : stepIndex / 3 + 0.05;
    const exitStart = (stepIndex + 1) / 3 - 0.1;
    const exitEnd = (stepIndex + 1) / 3;

    let opacity = 0;
    let y = 30;

    if (stepIndex === 0) {
      if (currentProgress < exitStart) {
        opacity = 1;
        y = 0;
      } else if (currentProgress < exitEnd) {
        const t = (currentProgress - exitStart) / (exitEnd - exitStart);
        opacity = 1 - t;
        y = -20 * t;
      }
    } else if (stepIndex === 2) {
      if (currentProgress < enterStart) {
        opacity = 0;
        y = 30;
      } else if (currentProgress < enterEnd) {
        const t = (currentProgress - enterStart) / (enterEnd - enterStart);
        opacity = t;
        y = 30 * (1 - t);
      } else {
        opacity = 1;
        y = 0;
      }
    } else {
      if (currentProgress < enterStart) {
        opacity = 0;
        y = 30;
      } else if (currentProgress < enterEnd) {
        const t = (currentProgress - enterStart) / (enterEnd - enterStart);
        opacity = t;
        y = 30 * (1 - t);
      } else if (currentProgress < exitStart) {
        opacity = 1;
        y = 0;
      } else if (currentProgress < exitEnd) {
        const t = (currentProgress - exitStart) / (exitEnd - exitStart);
        opacity = 1 - t;
        y = -20 * t;
      } else {
        opacity = 0;
        y = -20;
      }
    }

    return { opacity, y };
  };

  const step0 = getStepValues(0);
  const step1 = getStepValues(1);
  const step2 = getStepValues(2);
  const stepValues = [step0, step1, step2];

  return (
    <section ref={containerRef} className="relative" style={{ height: '300vh' }}>

      <div className="sticky top-0 h-screen overflow-hidden flex flex-col">
        <ProgressBar scrollProgress={currentProgress} />

        <div className="flex-1 flex items-center">
          <div className="max-w-[1200px] mx-auto px-6 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center w-full">
            {/* Left: Text — crossfade between steps */}
            <div className="relative min-h-[320px]">
              {steps.map((step, i) => {
                const { opacity, y } = stepValues[i];
                return (
                  <motion.div
                    key={i}
                    className="absolute inset-0 flex flex-col justify-center"
                    style={{ opacity, y, pointerEvents: opacity > 0.5 ? 'auto' : 'none' }}
                  >
                    {/* Decorative big number */}
                    <div className="absolute -left-2 -top-4 font-heading text-[8rem] font-black text-foreground/[0.03] leading-none select-none pointer-events-none">
                      {step.num}
                    </div>

                    {/* Badge */}
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 mb-5 self-start">
                      <step.icon className="w-3.5 h-3.5 text-primary" />
                      <span className="text-xs font-mono text-primary tracking-wider uppercase">{step.badge}</span>
                    </div>

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

            {/* Right: Visuals — crossfade with scale */}
            <div className="relative h-[450px]">
              {/* Step 0: CVE Cards floating with stagger & rotation */}
              <motion.div
                style={{ opacity: step0.opacity, pointerEvents: step0.opacity > 0.3 ? 'auto' : 'none' }}
                className="absolute inset-0"
              >
                <CVECard cve="CVE-2025-21613" x="5%" y="5%" opacity={step0.opacity} scale={step0.opacity} rotate={-2} />
                <CVECard cve="CVE-2024-53990" x="15%" y="35%" opacity={step0.opacity} scale={step0.opacity} rotate={1} size="lg" />
                <CVECard cve="CVE-2024-53194" x="25%" y="62%" opacity={step0.opacity} scale={step0.opacity} rotate={-1} size="sm" />
              </motion.div>

              {/* Step 1: Sankey chart with slide-in */}
              <motion.div
                style={{ opacity: step1.opacity, pointerEvents: step1.opacity > 0.3 ? 'auto' : 'none' }}
                className="absolute inset-0 flex items-center"
              >
                <SankeyChart opacity={step1.opacity} />
              </motion.div>

              {/* Step 2: Workflow with enhanced stagger */}
              <motion.div
                style={{ opacity: step2.opacity, pointerEvents: step2.opacity > 0.3 ? 'auto' : 'none' }}
                className="absolute inset-0 flex flex-col justify-center gap-3 max-w-md ml-auto"
              >
                <motion.div
                  className="glass-container px-5 py-3 rounded-xl mb-2"
                  style={{ opacity: step2.opacity }}
                  initial={{ scale: 0.95 }}
                  animate={{ scale: step2.opacity > 0.5 ? 1 : 0.95 }}
                  transition={{ duration: 0.5, ease: EASE }}
                >
                  <div className="font-mono text-sm text-foreground/90 mb-2">CVE-2024-53194</div>
                  <div className="flex gap-2">
                    {['Exploitable', 'High Likelihood', 'Critical Impact'].map((t) => (
                      <span key={t} className="text-[10px] font-mono text-destructive/80">{t}</span>
                    ))}
                  </div>
                </motion.div>
                <WorkflowStepCard num="01" label="Incidente criado" visible={step2.opacity > 0.5} delay={0.1} />
                <WorkflowStepCard num="02" label="Política WAF implantada" visible={step2.opacity > 0.5} delay={0.25} />
                <WorkflowStepCard num="03" label="Ticket criado" visible={step2.opacity > 0.5} delay={0.4} />
                <WorkflowStepCard num="04" label="Notificação enviada para #segurança" visible={step2.opacity > 0.5} delay={0.55} />
              </motion.div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
