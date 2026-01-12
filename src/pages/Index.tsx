import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Header } from '@/components/Header';
import { Shield, CheckCircle2, AlertTriangle, TrendingUp, LogIn } from 'lucide-react';
import { Button } from '@/components/ui/button';

const Index = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) {
      navigate('/dashboard');
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="px-6 py-12">
        {/* Hero Section */}
        <div className="max-w-4xl mx-auto text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6 animate-fade-in">
            <Shield className="w-4 h-4" />
            Ferramenta de Auditoria FortiGate
          </div>
          <h1 className="text-4xl lg:text-5xl font-bold text-foreground mb-4 animate-fade-in" style={{ animationDelay: '0.1s' }}>
            Valide seu Firewall em
            <span className="text-primary"> Minutos</span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto animate-fade-in" style={{ animationDelay: '0.2s' }}>
            Conecte-se ao seu FortiGate e receba uma análise completa de compliance, 
            segurança e boas práticas com recomendações acionáveis.
          </p>
        </div>

        {/* Features Grid */}
        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
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
              style={{ animationDelay: `${0.3 + index * 0.1}s` }}
            >
              <div className="inline-flex p-3 rounded-lg bg-primary/10 mb-4">
                <feature.icon className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-semibold text-foreground mb-2">{feature.title}</h3>
              <p className="text-sm text-muted-foreground">{feature.description}</p>
            </div>
          ))}
        </div>

        {/* CTA Section */}
        <div className="max-w-md mx-auto text-center animate-fade-in" style={{ animationDelay: '0.5s' }}>
          <Button 
            onClick={() => navigate('/auth')}
            size="lg"
            className="gap-2"
          >
            <LogIn className="w-5 h-5" />
            Acessar Plataforma
          </Button>
          <p className="text-sm text-muted-foreground mt-4">
            Faça login para gerenciar seus firewalls e visualizar relatórios de compliance
          </p>
        </div>
      </main>
    </div>
  );
};

export default Index;