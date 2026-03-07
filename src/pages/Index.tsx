import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Header } from '@/components/Header';
import { CheckCircle2, AlertTriangle, TrendingUp } from 'lucide-react';

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
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col cyber-grid">
      <Header />
      
      <main className="flex-1 flex flex-col justify-center px-6 py-12">
        {/* Hero Section */}
        <div className="max-w-4xl mx-auto text-center mb-12">
          <h1 className="text-4xl lg:text-5xl font-bold text-foreground mb-4 animate-fade-in">
            Gerencie sua Infraestrutura
            <span className="text-primary"> com Inteligência</span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto animate-fade-in" style={{ animationDelay: '0.1s' }}>
            Plataforma completa para análise de compliance, segurança e 
            boas práticas da sua infraestrutura de rede.
          </p>
        </div>

        {/* Features Grid */}
        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              icon: CheckCircle2,
              title: 'Verificações Automáticas',
              description: 'Mais de 50 pontos de verificação baseados em boas práticas',
            },
            {
              icon: AlertTriangle,
              title: 'Detecção de Riscos',
              description: 'Identifica vulnerabilidades e configurações inseguras',
            },
            {
              icon: TrendingUp,
              title: 'Recomendações',
              description: 'Sugestões práticas para melhorar sua postura de segurança',
            },
          ].map((feature, index) => (
            <div 
              key={feature.title}
              className="glass-card rounded-xl p-6 text-center animate-fade-in"
              style={{ animationDelay: `${0.2 + index * 0.1}s` }}
            >
              <div className="inline-flex p-3 rounded-lg bg-primary/10 mb-4">
                <feature.icon className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-semibold text-foreground mb-2">{feature.title}</h3>
              <p className="text-sm text-muted-foreground">{feature.description}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
};

export default Index;