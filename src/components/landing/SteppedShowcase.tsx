import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
  delay = 0,
}: {
  cve: string;
  x: string;
  y: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
      className="absolute glass-container px-5 py-3 rounded-xl"
      style={{ left: x, top: y }}
    >
      <div className="flex items-center gap-2 mb-2">
        <div className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
        <span className="font-mono text-sm text-foreground/90">{cve}</span>
      </div>
      <div className="flex gap-2">
        {['Exploitable', 'High Likelihood', 'Critical Impact'].map((tag) => (
          <span
            key={tag}
            className="text-[10px] font-mono text-destructive/80 tracking-wide"
          >
            {tag}
          </span>
        ))}
      </div>
    </motion.div>
  );
}

/* ── Workflow Step ── */
function WorkflowStep({
  num,
  label,
  delay = 0,
}: {
  num: string;
  label: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 40 }}
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

/* ── Risk Nodes (step 2 visual) ── */
function RiskNodes() {
  const nodes = [
    { label: 'Critical', color: 'bg-destructive', size: 'w-20 h-20', x: '20%', y: '15%' },
    { label: 'High', color: 'bg-warning', size: 'w-14 h-14', x: '55%', y: '30%' },
    { label: 'Medium', color: 'bg-info', size: 'w-10 h-10', x: '35%', y: '55%' },
    { label: 'Low', color: 'bg-muted-foreground/40', size: 'w-7 h-7', x: '65%', y: '65%' },
    { label: 'Info', color: 'bg-muted-foreground/20', size: 'w-5 h-5', x: '75%', y: '20%' },
  ];

  return (
    <>
      {nodes.map((n, i) => (
        <motion.div
          key={n.label}
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0 }}
          transition={{ duration: 0.6, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] }}
          className="absolute flex flex-col items-center gap-1"
          style={{ left: n.x, top: n.y }}
        >
          <div className={`${n.size} ${n.color} rounded-full opacity-20 blur-sm absolute`} />
          <div className={`${n.size} ${n.color} rounded-full opacity-60 relative flex items-center justify-center`}>
            <span className="text-[9px] font-mono text-foreground/90 font-semibold">{n.label}</span>
          </div>
        </motion.div>
      ))}
      {/* Connecting lines */}
      <svg className="absolute inset-0 w-full h-full" style={{ zIndex: 0 }}>
        <motion.line
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 0.15 }}
          transition={{ duration: 1.2, delay: 0.5 }}
          x1="30%" y1="25%" x2="60%" y2="37%"
          stroke="hsl(var(--primary))" strokeWidth="1"
        />
        <motion.line
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 0.15 }}
          transition={{ duration: 1.2, delay: 0.7 }}
          x1="60%" y1="37%" x2="42%" y2="60%"
          stroke="hsl(var(--primary))" strokeWidth="1"
        />
      </svg>
    </>
  );
}

/* ── Step Visuals ── */
function StepVisual({ step }: { step: number }) {
  return (
    <div className="relative w-full h-[400px]">
      <AnimatePresence mode="wait">
        {step === 0 && (
          <motion.div key="s0" className="absolute inset-0">
            <CVECard cve="CVE-2025-21613" x="25%" y="8%" delay={0} />
            <CVECard cve="CVE-2024-53990" x="8%" y="38%" delay={0.15} />
            <CVECard cve="CVE-2024-53194" x="40%" y="52%" delay={0.3} />
          </motion.div>
        )}
        {step === 1 && (
          <motion.div key="s1" className="absolute inset-0">
            <RiskNodes />
          </motion.div>
        )}
        {step === 2 && (
          <motion.div key="s2" className="absolute inset-0 flex flex-col justify-center gap-3 max-w-md ml-auto">
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5 }}
              className="glass-container px-5 py-3 rounded-xl mb-2"
            >
              <div className="font-mono text-sm text-foreground/90 mb-2">CVE-2024-53194</div>
              <div className="flex gap-2">
                {['Exploitable', 'High Likelihood', 'Critical Impact'].map((t) => (
                  <span key={t} className="text-[10px] font-mono text-destructive/80">{t}</span>
                ))}
              </div>
            </motion.div>
            <WorkflowStep num="01" label="Incidente criado" delay={0.2} />
            <WorkflowStep num="02" label="Política WAF implantada" delay={0.35} />
            <WorkflowStep num="03" label="Ticket criado" delay={0.5} />
            <WorkflowStep num="04" label="Notificação enviada para #segurança" delay={0.65} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Progress Bar ── */
function ProgressBar({
  activeStep,
  onStepClick,
}: {
  activeStep: number;
  onStepClick: (i: number) => void;
}) {
  return (
    <div className="flex items-center w-full max-w-[1200px] mx-auto mb-16 px-6">
      {steps.map((s, i) => {
        const isActive = i === activeStep;
        const isPast = i < activeStep;
        return (
          <div key={s.num} className="flex items-center flex-1">
            <button
              onClick={() => onStepClick(i)}
              className="flex items-center gap-2 group cursor-pointer"
            >
              <span
                className={`font-mono text-sm transition-colors duration-300 ${
                  isActive ? 'text-foreground' : 'text-muted-foreground/40'
                }`}
              >
                {s.num}
              </span>
            </button>
            {i < steps.length - 1 && (
              <div className="flex-1 mx-3 h-px relative">
                <div className="absolute inset-0 bg-muted-foreground/10" />
                {/* Dots on the line */}
                <div className="absolute inset-0 flex items-center">
                  <div
                    className="h-px transition-all duration-700 ease-out"
                    style={{
                      width: isPast ? '100%' : isActive ? '50%' : '0%',
                      background: `linear-gradient(90deg, hsl(var(--primary) / 0.4), hsl(var(--primary) / 0.1))`,
                    }}
                  />
                </div>
                {isActive && (
                  <motion.div
                    layoutId="progress-dot"
                    className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-primary shadow-lg shadow-primary/40"
                    style={{
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                    }}
                    transition={{ type: 'spring', stiffness: 200, damping: 25 }}
                  />
                )}
                {isPast && (
                  <div
                    className="absolute top-1/2 -translate-y-1/2 right-0 w-2 h-2 rounded-full bg-primary/40"
                  />
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ── Main Component ── */
export function SteppedShowcase() {
  const [activeStep, setActiveStep] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const nextStep = useCallback(() => {
    setActiveStep((prev) => (prev + 1) % steps.length);
  }, []);

  useEffect(() => {
    if (isPaused) return;
    const timer = setInterval(nextStep, 6000);
    return () => clearInterval(timer);
  }, [isPaused, nextStep]);

  const handleStepClick = (i: number) => {
    setActiveStep(i);
    setIsPaused(true);
    // Resume auto-play after 12s
    setTimeout(() => setIsPaused(false), 12000);
  };

  const current = steps[activeStep];

  return (
    <section className="relative py-[120px] overflow-hidden">
      {/* Particle background effect */}
      <div className="absolute inset-0 animated-grid-dots grid-radial-mask opacity-60" />

      <ProgressBar activeStep={activeStep} onStepClick={handleStepClick} />

      <div className="max-w-[1200px] mx-auto px-6 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center min-h-[420px]">
        {/* Left: Text */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeStep}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          >
            <h2 className="font-heading text-3xl lg:text-[2.75rem] font-bold leading-tight text-foreground whitespace-pre-line mb-6">
              {current.title}
            </h2>
            <p className="text-muted-foreground text-lg leading-relaxed max-w-md">
              {current.description}
            </p>
          </motion.div>
        </AnimatePresence>

        {/* Right: Visual */}
        <StepVisual step={activeStep} />
      </div>
    </section>
  );
}
