import { useEffect, useState } from "react";

interface ScoreGaugeProps {
  score: number;
  size?: number;
}

export function ScoreGauge({ score, size = 200 }: ScoreGaugeProps) {
  const [animatedScore, setAnimatedScore] = useState(0);

  useEffect(() => {
    const duration = 1500;
    const steps = 60;
    const increment = score / steps;
    let current = 0;

    const timer = setInterval(() => {
      current += increment;
      if (current >= score) {
        setAnimatedScore(score);
        clearInterval(timer);
      } else {
        setAnimatedScore(Math.round(current));
      }
    }, duration / steps);

    return () => clearInterval(timer);
  }, [score]);

  const shadowBlur = 16; // Extra space for the glow effect
  const svgSize = size + shadowBlur * 2;
  const center = svgSize / 2;
  const radius = (size - 20) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (animatedScore / 100) * circumference;

  const getColor = () => {
    if (score >= 75) return "hsl(var(--primary))"; // Verde-água do tema
    if (score >= 60) return "hsl(var(--warning))";
    return "hsl(var(--destructive))";
  };

  const getLabel = () => {
    if (score >= 90) return "Excelente";
    if (score >= 75) return "Bom";
    if (score >= 60) return "Atenção";
    return "Risco Alto";
  };

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={svgSize} height={svgSize} className="transform -rotate-90">
        {/* Background circle */}
        <circle cx={center} cy={center} r={radius} fill="none" stroke="hsl(var(--muted))" strokeWidth="12" />
        {/* Progress circle */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={getColor()}
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className="transition-all duration-1000 ease-out"
          style={{
            filter: `drop-shadow(0 0 4px ${getColor()})`,
          }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-5xl font-bold tabular-nums" style={{ color: getColor() }}>
          {animatedScore}
        </span>
        <span className="text-sm text-muted-foreground mt-1">de 100</span>
        <span
          className="text-xs font-medium mt-2 px-3 py-1 rounded-full"
          style={{
            backgroundColor: `${getColor()}20`,
            color: getColor(),
          }}
        >
          {getLabel()}
        </span>
      </div>
    </div>
  );
}
