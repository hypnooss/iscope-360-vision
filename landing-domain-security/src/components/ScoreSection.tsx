import { motion } from 'framer-motion';

const categories = [
  { name: 'DNS Security', weight: '25%', color: 'hsl(175, 80%, 45%)' },
  { name: 'SSL/TLS', weight: '25%', color: 'hsl(200, 70%, 50%)' },
  { name: 'HTTP Headers', weight: '25%', color: 'hsl(260, 60%, 55%)' },
  { name: 'Subdomínios', weight: '25%', color: 'hsl(35, 80%, 55%)' },
];

const severities = [
  { level: 'Crítico', color: 'bg-red-500', desc: 'Vulnerabilidade que pode ser explorada imediatamente' },
  { level: 'Alto', color: 'bg-orange-500', desc: 'Risco significativo que precisa de atenção urgente' },
  { level: 'Médio', color: 'bg-yellow-500', desc: 'Melhoria importante para aumentar a segurança' },
  { level: 'Baixo', color: 'bg-blue-500', desc: 'Recomendação de boas práticas' },
];

export function ScoreSection() {
  return (
    <section className="py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <span className="text-brand text-sm font-semibold uppercase tracking-wider">Score de Compliance</span>
          <h2 className="font-heading text-3xl sm:text-4xl font-bold mt-3 mb-4">
            Score de <span className="text-gradient">0 a 100</span> para cada domínio
          </h2>
          <p className="text-text-muted max-w-2xl mx-auto">
            Cada verificação contribui para um score que representa o nível real de segurança do seu domínio.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Score gauge visual */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="flex flex-col items-center justify-center"
          >
            <div className="relative w-48 h-48 mb-8">
              <svg viewBox="0 0 200 200" className="w-full h-full">
                <circle
                  cx="100" cy="100" r="85"
                  fill="none"
                  stroke="hsla(220, 15%, 20%, 0.5)"
                  strokeWidth="12"
                />
                <circle
                  cx="100" cy="100" r="85"
                  fill="none"
                  stroke="hsl(175, 80%, 45%)"
                  strokeWidth="12"
                  strokeDasharray={`${0.79 * 2 * Math.PI * 85} ${2 * Math.PI * 85}`}
                  strokeLinecap="round"
                  transform="rotate(-90 100 100)"
                  style={{ filter: 'drop-shadow(0 0 8px hsl(175, 80%, 45%, 0.4))' }}
                />
                <text x="100" y="95" textAnchor="middle" className="fill-text text-5xl font-heading font-extrabold">
                  79
                </text>
                <text x="100" y="120" textAnchor="middle" className="fill-text-muted text-sm">
                  /100
                </text>
              </svg>
            </div>
            <div className="flex flex-wrap justify-center gap-3">
              {categories.map((cat) => (
                <div
                  key={cat.name}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-surface-border bg-surface-raised text-xs"
                >
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cat.color }} />
                  <span className="text-text-muted">{cat.name}</span>
                  <span className="text-text font-semibold">{cat.weight}</span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Severity levels */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="flex flex-col justify-center"
          >
            <h3 className="font-heading text-xl font-bold mb-6">Níveis de Severidade</h3>
            <div className="space-y-4">
              {severities.map((sev) => (
                <div key={sev.level} className="flex items-start gap-4 p-4 rounded-xl bg-surface-raised border border-surface-border">
                  <span className={`w-3 h-3 rounded-full mt-1 ${sev.color} flex-shrink-0`} />
                  <div>
                    <span className="font-semibold text-text">{sev.level}</span>
                    <p className="text-sm text-text-muted mt-0.5">{sev.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
